import 'server-only';

// Server-only entry point for the service-role client. App code imports this module so a client
// component can never bundle the service key; integration tests import ./service-client directly.
export { createServiceClient } from './service-client';
