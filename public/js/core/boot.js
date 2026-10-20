/* Global safety nets (errors, offline/online) */
// ── Panel switching


// ── v0.7.1: global safety nets
window.addEventListener('unhandledrejection',e=>{console.warn('Unhandled:',e.reason);try{toast('Something went wrong. Please try again.');}catch(_){}});
window.addEventListener('offline',()=>toast('You are offline. Changes will not save until you reconnect.'));
window.addEventListener('online',()=>toast('Back online.','good'));
