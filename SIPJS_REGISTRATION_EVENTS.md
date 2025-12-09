# SIP.js Registration Expiration Events

## Overview

SIP.js uses the `Registerer` class to manage SIP registration. Unlike some other SIP libraries (like JsSIP), **SIP.js does not provide a specific "expiration" event**. Instead, it uses a `stateChange` event that fires when the registration state changes, including when it expires.

## Available Events

### `stateChange` Event

The primary event for monitoring registration status is `stateChange`:

```typescript
registerer.stateChange.addListener((state) => {
  switch (state) {
    case 'Registered':
      // Registration successful
      break;
    case 'Unregistered':
      // Registration expired or was unregistered
      break;
    case 'Terminated':
      // Registerer was terminated
      break;
    case 'Initial':
      // Initial state before registration
      break;
  }
});
```

### Registration States

1. **`'Initial'`**: The registerer is created but not yet registered
2. **`'Registered'`**: Successfully registered with the SIP server
3. **`'Unregistered'`**: Registration has expired or was explicitly unregistered
4. **`'Terminated'`**: The registerer has been terminated

## How Expiration is Detected

### Method 1: State Change Event (Primary)

When a registration expires, SIP.js automatically fires the `stateChange` event with `'Unregistered'` state:

```typescript
registerer.stateChange.addListener((state) => {
  if (state === 'Unregistered') {
    // Registration expired - handle re-registration
    console.log('⚠️ Registration expired - re-registering...');
    await registerer.register();
  }
});
```

### Method 2: Time-Based Detection (Fallback)

Since SIP.js doesn't provide a "before expiration" event, you can track the expiry time and check periodically:

```typescript
// When registration succeeds, store expiry time
case 'Registered':
  const expires = registerer.expires; // Expiry time in seconds
  const expiryTime = Date.now() + (expires * 1000);
  // Check periodically if expired
  setInterval(() => {
    if (Date.now() >= expiryTime && registerer.state === 'Unregistered') {
      // Registration expired - re-register
      await registerer.register();
    }
  }, 10000); // Check every 10 seconds
```

### Method 3: Proactive Refresh (Recommended)

The best practice is to refresh registration **before** it expires:

```typescript
case 'Registered':
  const expires = registerer.expires; // e.g., 600 seconds
  // Refresh at 50% of expiry time (300 seconds)
  setTimeout(() => {
    registerer.register(); // Refresh registration
  }, expires * 500); // 50% of expiry time
```

## Current Implementation

The current implementation in `sipService.ts` uses a combination of all three methods:

1. **State Change Listener**: Listens for `'Unregistered'` state and auto re-registers
2. **Proactive Refresh**: Refreshes at 50% of expiry time to prevent expiration
3. **Periodic Expiry Check**: Checks every 10 seconds if registration has expired

### Code Example

```typescript
// 1. Listen to state changes
registerer.stateChange.addListener((state) => {
  switch (state) {
    case 'Registered':
      // Store expiry time and schedule refresh
      const expires = registerer.expires;
      scheduleRegistrationRefresh(expires);
      break;
    case 'Unregistered':
      // Auto re-register when expiration detected
      autoReRegister();
      break;
  }
});

// 2. Proactive refresh (50% of expiry time)
function scheduleRegistrationRefresh(expiresSeconds: number) {
  const refreshDelay = expiresSeconds * 500; // 50% of expiry
  setTimeout(() => {
    registerer.register(); // Refresh before expiration
  }, refreshDelay);
}

// 3. Periodic expiry check (every 10 seconds)
setInterval(() => {
  if (registrationExpiryTime && Date.now() >= registrationExpiryTime) {
    if (registerer.state === 'Unregistered') {
      autoReRegister();
    }
  }
}, 10000);
```

## Key Points

1. **No "expiration" event**: SIP.js doesn't have a specific expiration event - it fires `'Unregistered'` when registration expires
2. **State-based**: Use `stateChange` event to detect expiration
3. **Proactive refresh**: Best practice is to refresh before expiration (typically at 50% of expiry time)
4. **Automatic handling**: The current implementation automatically re-registers when expiration is detected

## Comparison with Other Libraries

- **JsSIP**: Provides `registrationExpiring` event that fires before expiration
- **SIP.js**: Only provides `stateChange` with `'Unregistered'` state when expired
- **Solution**: Use proactive refresh + state change listener for best results

## Best Practices

1. ✅ **Proactive Refresh**: Refresh at 50% of expiry time to prevent expiration
2. ✅ **State Change Listener**: Handle `'Unregistered'` state for automatic re-registration
3. ✅ **Periodic Check**: Use time-based checks as a fallback
4. ✅ **Error Handling**: Retry re-registration on failure
5. ✅ **Connection Check**: Ensure UA is connected before re-registering

