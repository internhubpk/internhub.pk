/**
 * InternHub Middleware Entry Point
 * 
 * This file serves as the entry point for Next.js middleware.
 * It delegates to the proxy function which handles:
 * 1. Subdomain-based tenant detection
 * 2. Authentication state management  
 * 3. Route protection
 * 4. Tenant context propagation via headers
 */

import { proxy } from "@/proxy";

export default proxy;

// Matcher configuration is exported from proxy.ts
export { config } from "@/proxy";
