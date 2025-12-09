# SIP Call Flow - Outbound Call

This document shows the SIP message flow between the local client and remote party when making an outbound call.

## Complete Outbound Call Flow

```
┌─────────────┐                                    ┌─────────────┐
│ Local Client│                                    │ Remote Party│
│  (SIP.js)   │                                    │  (SIP UA)   │
└──────┬──────┘                                    └──────┬──────┘
       │                                                   │
       │ 1. INVITE (with SDP offer)                       │
       │──────────────────────────────────────────────────>│
       │    Session State: Initial → InviteSent           │
       │    Call Status: RINGING                           │
       │                                                   │
       │ 2. 100 Trying                                    │
       │<──────────────────────────────────────────────────│
       │                                                   │
       │ 3. 180 Ringing (optional)                        │
       │<──────────────────────────────────────────────────│
       │    Call Status: RINGING                           │
       │                                                   │
       │ 4. 200 OK (with SDP answer)                      │
       │<──────────────────────────────────────────────────│
       │    Session State: InviteSent → Established       │
       │    Call Status: ACTIVE                            │
       │                                                   │
       │ 5. ACK                                           │
       │──────────────────────────────────────────────────>│
       │    Dialog State: Confirmed                       │
       │    Media: WebRTC connection established          │
       │                                                   │
       │ ============ CALL IN PROGRESS ============       │
       │                                                   │
       │    Media: Audio/Video streams flowing            │
       │                                                   │
       │ ============ CALL TERMINATION ============        │
       │                                                   │
       │ 6. BYE                                           │
       │──────────────────────────────────────────────────>│
       │    Session State: Established → Terminating      │
       │    (Wait for dialog to be "Confirmed" first)     │
       │                                                   │
       │ 7. 200 OK                                        │
       │<──────────────────────────────────────────────────│
       │    Session State: Terminating → Terminated       │
       │    Call Status: IDLE                              │
       │                                                   │
       │    Cleanup: Stop media tracks, close streams     │
       │                                                   │
```

## Detailed Message Flow

### 1. Call Initiation (INVITE)

**Local Client → Remote Party**

```
INVITE sip:remote@domain.com SIP/2.0
Via: SIP/2.0/WSS ...
From: <sip:local@domain.com>;tag=...
To: <sip:remote@domain.com>
Call-ID: ...
CSeq: 1 INVITE
Contact: <sip:local@domain.com>
Content-Type: application/sdp
Content-Length: ...

v=0
o=- ... IN IP4 ...
s=-
t=0 0
c=IN IP4 ...
m=audio ... RTP/SAVPF ...
a=rtpmap:... opus/48000/2
m=video ... RTP/SAVPF ...
a=rtpmap:... VP8/90000
...
```

**What happens:**
- `makeCall()` creates an `Inviter` session
- Session state: `Initial` → `InviteSent`
- Call status: `RINGING`
- SDP offer contains local media capabilities (audio/video codecs)

**Code location:** `src/services/sipService.ts`
- `makeCall()` method (line ~625)
- `inviter.invite()` sends the INVITE (line ~900)
- Session state listener: `InviteSent` case (line ~2072)

### 2. Provisional Response (100 Trying)

**Remote Party → Local Client**

```
SIP/2.0 100 Trying
Via: SIP/2.0/WSS ...
From: <sip:local@domain.com>;tag=...
To: <sip:remote@domain.com>
Call-ID: ...
CSeq: 1 INVITE
```

**What happens:**
- Remote party acknowledges receipt of INVITE
- Processing the request

### 3. Ringing Response (180 Ringing) - Optional

**Remote Party → Local Client**

```
SIP/2.0 180 Ringing
Via: SIP/2.0/WSS ...
From: <sip:local@domain.com>;tag=...
To: <sip:remote@domain.com>;tag=...
Call-ID: ...
CSeq: 1 INVITE
Contact: <sip:remote@domain.com>
```

**What happens:**
- Remote party is alerting the user
- Call status remains: `RINGING`
- User sees/hears ringing indication

### 4. Success Response (200 OK)

**Remote Party → Local Client**

```
SIP/2.0 200 OK
Via: SIP/2.0/WSS ...
From: <sip:local@domain.com>;tag=...
To: <sip:remote@domain.com>;tag=...
Call-ID: ...
CSeq: 1 INVITE
Contact: <sip:remote@domain.com>
Content-Type: application/sdp
Content-Length: ...

v=0
o=- ... IN IP4 ...
s=-
t=0 0
c=IN IP4 ...
m=audio ... RTP/SAVPF ...
a=rtpmap:... opus/48000/2
m=video ... RTP/SAVPF ...
a=rtpmap:... VP8/90000
...
```

**What happens:**
- Session state: `InviteSent` → `Established`
- Call status: `ACTIVE`
- SDP answer contains remote media capabilities
- WebRTC peer connection negotiation begins
- Local and remote media streams are set up

**Code location:** `src/services/sipService.ts`
- Session state listener: `Established` case (line ~2076)
- `setupPeerConnectionListeners()` sets up media (line ~2079)
- Local stream setup after ACK (line ~2083)

### 5. Acknowledgment (ACK)

**Local Client → Remote Party**

```
ACK sip:remote@domain.com SIP/2.0
Via: SIP/2.0/WSS ...
From: <sip:local@domain.com>;tag=...
To: <sip:remote@domain.com>;tag=...
Call-ID: ...
CSeq: 1 ACK
```

**What happens:**
- SIP.js automatically sends ACK after receiving 200 OK
- Dialog state: `Confirmed`
- Media streams are now active
- **CRITICAL**: Dialog must be "Confirmed" before sending BYE

**Code location:** `src/services/sipService.ts`
- ACK is sent automatically by SIP.js after 200 OK
- Dialog state check in `hangup()` (line ~1564-1582)
- Wait for dialog to be "Confirmed" before BYE (line ~1567-1582)

### 6. Call Termination (BYE)

**Local Client → Remote Party**

```
BYE sip:remote@domain.com SIP/2.0
Via: SIP/2.0/WSS ...
From: <sip:local@domain.com>;tag=...
To: <sip:remote@domain.com>;tag=...
Call-ID: ...
CSeq: 2 BYE
```

**What happens:**
- `hangup()` is called
- **Wait for dialog to be "Confirmed"** (ensures ACK was sent)
- Session state: `Established` → `Terminating`
- Media tracks are stopped
- Peer connection is closed

**Code location:** `src/services/sipService.ts`
- `hangup()` method (line ~1509)
- Dialog state verification (line ~1559-1582)
- `session.bye()` sends BYE (line ~1568)
- Cleanup after BYE (line ~1696-1747)

### 7. Termination Response (200 OK)

**Remote Party → Local Client**

```
SIP/2.0 200 OK
Via: SIP/2.0/WSS ...
From: <sip:local@domain.com>;tag=...
To: <sip:remote@domain.com>;tag=...
Call-ID: ...
CSeq: 2 BYE
```

**What happens:**
- Session state: `Terminating` → `Terminated`
- Call status: `IDLE`
- All resources are cleaned up
- Ready for new calls

**Code location:** `src/services/sipService.ts`
- Session state listener: `Terminated` case (line ~2079)
- `cleanup()` method handles resource cleanup
- Delegate verification after termination (line ~2118-2141)

## Error Scenarios

### Call Cancelled (Before Answer)

```
Local Client                    Remote Party
     │                               │
     │─── INVITE ───────────────────>│
     │                               │
     │─── CANCEL ───────────────────>│
     │                               │
     │<── 200 OK (to INVITE) ────────│
     │                               │
     │<── 200 OK (to CANCEL) ────────│
     │                               │
```

### Call Rejected

```
Local Client                    Remote Party
     │                               │
     │─── INVITE ───────────────────>│
     │                               │
     │<── 100 Trying ────────────────│
     │                               │
     │<── 486 Busy Here ─────────────│
     │                               │
     │─── ACK ──────────────────────>│
     │                               │
```

### Network Error (No Response)

```
Local Client                    Remote Party
     │                               │
     │─── INVITE ───────────────────>│
     │                               │
     │   (Timeout - no response)     │
     │                               │
     │   Session: Terminated          │
     │   Call Status: FAILED          │
     │                               │
```

## SIP Dialog Scope

### What is a Dialog?

A **SIP dialog** is a peer-to-peer relationship between two user agents that persists for some duration. It represents the stateful relationship between two endpoints for a specific call or subscription.

### Dialog Identification

A dialog is uniquely identified by three values:
1. **Call-ID**: Unique identifier for the call (same for all messages in the call)
2. **Local Tag**: Tag in the `From` header (generated by the caller)
3. **Remote Tag**: Tag in the `To` header (generated by the callee)

```
INVITE Request:
From: <sip:alice@example.com>;tag=abc123    ← Local tag (caller's tag)
To: <sip:bob@example.com>                   ← No tag yet
Call-ID: xyz789@example.com                 ← Call-ID

200 OK Response:
From: <sip:alice@example.com>;tag=abc123    ← Local tag (same)
To: <sip:bob@example.com>;tag=def456        ← Remote tag (callee's tag)
Call-ID: xyz789@example.com                 ← Call-ID (same)

Dialog ID: (Call-ID: xyz789, Local: abc123, Remote: def456)
```

### Dialog-Creating Requests

These requests **create** a new dialog when they receive a 2xx response:

1. **INVITE** - Creates a dialog for a call
   - Dialog created when 200 OK is received
   - Confirmed when ACK is sent

2. **SUBSCRIBE** - Creates a dialog for event subscriptions
   - Dialog created when 200 OK is received

3. **REFER** - Creates a dialog for call transfer
   - Dialog created when 200 OK is received

**Example:**
```
INVITE → 200 OK → ACK = Dialog Created and Confirmed
```

### Dialog-Using Requests

These requests **use** an existing dialog (must be sent within a confirmed dialog):

1. **BYE** - Terminates the dialog
   - Must be sent within a confirmed dialog
   - Terminates the dialog when 200 OK is received

2. **UPDATE** - Updates session parameters (e.g., media)
   - Can be sent in early or confirmed dialog
   - Used for re-INVITE without SDP

3. **INFO** - Sends mid-call information (e.g., DTMF)
   - Must be sent within a confirmed dialog

4. **PRACK** - Provisional ACK for reliable provisional responses
   - Used for 1xx responses that require acknowledgment

5. **re-INVITE** - Modifies the existing dialog (e.g., hold, video toggle)
   - Uses the same dialog as the original INVITE
   - Creates a new transaction but uses existing dialog

**Example:**
```
INVITE → 200 OK → ACK (Dialog Confirmed)
  ↓
BYE → 200 OK (Dialog Terminated)
```

### Dialog Scope Rules

1. **Dialog Creation**:
   - Dialog is created when a dialog-creating request receives a 2xx response
   - For INVITE, dialog is created in "Early" state after 1xx/2xx
   - Dialog becomes "Confirmed" after ACK is sent

2. **Dialog Usage**:
   - Dialog-using requests must include the same Call-ID and tags
   - Requests must match the dialog's identifiers exactly
   - If dialog doesn't exist, request will fail with 481 (Call/Transaction Does Not Exist)

3. **Dialog Termination**:
   - Dialog is terminated when BYE is sent and 200 OK is received
   - Dialog can also be terminated by timeout or error
   - Once terminated, dialog cannot be reused

### Message Routing Within Dialog

All messages within a dialog must include:
- Same **Call-ID**
- Same **From tag** (local tag)
- Same **To tag** (remote tag)
- Incrementing **CSeq** number

```
Dialog Messages:
┌─────────────────────────────────────────┐
│ Call-ID: xyz789                         │
│ From: alice@example.com;tag=abc123     │
│ To: bob@example.com;tag=def456         │
├─────────────────────────────────────────┤
│ INVITE  (CSeq: 1)  ← Creates dialog    │
│ 200 OK  (CSeq: 1)                       │
│ ACK     (CSeq: 1)  ← Confirms dialog    │
│ UPDATE  (CSeq: 2)  ← Uses dialog        │
│ 200 OK  (CSeq: 2)                       │
│ BYE     (CSeq: 3)  ← Uses dialog        │
│ 200 OK  (CSeq: 3)  ← Terminates dialog  │
└─────────────────────────────────────────┘
```

### Common Dialog Scope Issues

1. **404 Not Found for BYE**:
   - Dialog not confirmed (ACK not sent)
   - Dialog already terminated
   - Wrong Call-ID or tags

2. **481 Call/Transaction Does Not Exist**:
   - Dialog doesn't exist
   - Dialog already terminated
   - Mismatched Call-ID or tags

3. **200 OK Retransmissions**:
   - ACK not received
   - Dialog not confirmed
   - Network issues preventing ACK delivery

### Implementation in Your Codebase

**Dialog State Checking:**
```typescript
// In hangup() method - ensures dialog is confirmed before BYE
const dialog = (session as any).dialog;
const dialogState = dialog?.state;

if (dialog && dialogState !== 'Confirmed' && dialogState !== 'Terminated') {
  // Wait for dialog to become confirmed (ACK sent)
  // This prevents 404 errors when sending BYE
}
```

**Dialog Identification:**
- SIP.js automatically manages Call-ID, From tag, and To tag
- Dialog object is accessible via `session.dialog`
- Dialog state can be checked: `dialog.state` (Early, Confirmed, Terminated)

**Code location:** `src/services/sipService.ts`
- Dialog state check in `hangup()` (line ~1559-1582)
- Dialog verification before BYE (line ~1564-1582)
- Session dialog access: `(session as any).dialog`

### Dialog Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Dialog Lifecycle                          │
└─────────────────────────────────────────────────────────────┘

No Dialog
    │
    │ INVITE sent
    ▼
┌─────────────────┐
│  Early Dialog   │  ← Created after 1xx/2xx response
│  (Unconfirmed)  │     - Call-ID: xyz789
└─────────────────┘     - From tag: abc123
    │                    - To tag: def456
    │ 200 OK received
    │ ACK sent
    ▼
┌─────────────────┐
│ Confirmed Dialog│  ← Confirmed after ACK
│   (Active)      │     - Can now use dialog-using requests:
└─────────────────┘       • BYE (terminate)
    │                       • UPDATE (modify)
    │                       • INFO (send data)
    │                       • re-INVITE (modify)
    │
    │ BYE sent
    │ 200 OK received
    ▼
┌─────────────────┐
│Terminated Dialog│  ← Terminated after BYE/200 OK
│   (Dead)        │     - Cannot be reused
└─────────────────┘     - New call needs new INVITE
```

### Dialog Scope Examples

**Example 1: Successful Call**
```
INVITE (CSeq: 1)     → Creates Early Dialog
200 OK (CSeq: 1)     → Dialog becomes Confirmed
ACK (CSeq: 1)        → Dialog confirmed
BYE (CSeq: 2)        → Uses Confirmed Dialog ✓
200 OK (CSeq: 2)     → Dialog Terminated
```

**Example 2: BYE Before ACK (Error)**
```
INVITE (CSeq: 1)     → Creates Early Dialog
200 OK (CSeq: 1)     → Dialog still Early (not confirmed)
BYE (CSeq: 2)        → ❌ Dialog not confirmed → 404 Not Found
```

**Example 3: re-INVITE (Hold/Resume)**
```
INVITE (CSeq: 1)     → Creates Dialog
200 OK (CSeq: 1)     → Dialog Confirmed
ACK (CSeq: 1)        → 
re-INVITE (CSeq: 2)  → Uses same Dialog (hold call)
200 OK (CSeq: 2)     → 
ACK (CSeq: 2)        → 
re-INVITE (CSeq: 3)  → Uses same Dialog (resume call)
200 OK (CSeq: 3)     → 
ACK (CSeq: 3)        → 
BYE (CSeq: 4)        → Uses same Dialog
200 OK (CSeq: 4)     → Dialog Terminated
```

**Example 4: UPDATE Request**
```
INVITE (CSeq: 1)     → Creates Dialog
200 OK (CSeq: 1)     → Dialog Confirmed
ACK (CSeq: 1)        → 
UPDATE (CSeq: 2)     → Uses Dialog (modify media without re-INVITE)
200 OK (CSeq: 2)     → 
BYE (CSeq: 3)        → Uses Dialog
200 OK (CSeq: 3)     → Dialog Terminated
```

## Key Implementation Details

### Dialog States

1. **Early**: Dialog created but not confirmed (after 1xx/2xx response, before ACK)
2. **Confirmed**: Dialog confirmed (after ACK sent/received)
3. **Terminated**: Dialog terminated (after BYE and 200 OK)

### Session States (SIP.js)

- `Initial`: Session created, not yet sent
- `InviteSent`: INVITE sent, waiting for response
- `Establishing`: Received provisional response (180 Ringing)
- `Established`: Call active (200 OK received, ACK sent)
- `Terminating`: BYE sent, waiting for 200 OK
- `Terminated`: Call ended

### Call Status (Application Level)

- `IDLE`: No active call
- `REGISTERED`: Registered with SIP server
- `RINGING`: Call is ringing (outbound) or incoming call
- `CALLING`: Outbound call in progress
- `ACTIVE`: Call is active
- `ENDED`: Call ended normally
- `FAILED`: Call failed
- `UNREGISTERED`: Not registered

## Important Notes

1. **ACK is critical**: Must be sent after 200 OK to confirm the dialog. Without ACK, remote will retransmit 200 OK.

2. **Dialog confirmation**: Before sending BYE, ensure dialog is "Confirmed" to avoid 404 errors.

3. **Media setup**: WebRTC peer connection is established after SDP exchange (INVITE/200 OK).

4. **Cleanup timing**: Media tracks should be stopped after BYE is sent, not before.

5. **State synchronization**: Session state and call status are managed separately - session state is SIP.js internal, call status is application-level.

## Inbound Call Flow

For completeness, here's the inbound call flow (when receiving a call):

```
┌─────────────┐                                    ┌─────────────┐
│ Remote Party│                                    │ Local Client│
│  (SIP UA)   │                                    │  (SIP.js)   │
└──────┬──────┘                                    └──────┬──────┘
       │                                                   │
       │ 1. INVITE (with SDP offer)                       │
       │──────────────────────────────────────────────────>│
       │    onInvite delegate called                      │
       │    Session State: Initial                        │
       │    Call Status: INCOMING                          │
       │                                                   │
       │ 2. 100 Trying                                    │
       │<──────────────────────────────────────────────────│
       │                                                   │
       │ 3. 180 Ringing (optional)                        │
       │<──────────────────────────────────────────────────│
       │    Call Status: RINGING                           │
       │                                                   │
       │ 4. 200 OK (with SDP answer)                      │
       │<──────────────────────────────────────────────────│
       │    session.accept() called                       │
       │    Session State: Initial → Established           │
       │    Call Status: ACTIVE                            │
       │                                                   │
       │ 5. ACK                                           │
       │──────────────────────────────────────────────────>│
       │    Dialog State: Confirmed                       │
       │    Media: WebRTC connection established          │
       │                                                   │
       │ ============ CALL IN PROGRESS ============       │
       │                                                   │
       │    Media: Audio/Video streams flowing            │
       │                                                   │
       │ ============ CALL TERMINATION ============        │
       │                                                   │
       │ 6. BYE                                           │
       │<──────────────────────────────────────────────────│
       │    hangup() called                               │
       │    Session State: Established → Terminating      │
       │                                                   │
       │ 7. 200 OK                                        │
       │──────────────────────────────────────────────────>│
       │    Session State: Terminating → Terminated       │
       │    Call Status: IDLE                              │
       │                                                   │
       │    Cleanup: Stop media tracks, close streams     │
       │                                                   │
```

**Key differences from outbound:**
- Remote party initiates the INVITE
- `onInvite` delegate receives the invitation
- `session.accept()` sends 200 OK (instead of receiving it)
- Local client sends ACK automatically after accept
- BYE can be sent by either party

**Code location:** `src/services/sipService.ts`
- `onInvite` delegate (line ~1155)
- `handleIncomingCall()` (line ~1155)
- `session.accept()` (line ~1200)
- BYE handling in `hangup()` (line ~1612-1655)

