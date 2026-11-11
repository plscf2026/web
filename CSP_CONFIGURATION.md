# Content Security Policy (CSP) & Header Hardening Specification
## Sylhet Police Lines High School & College Reunion 2027
**Target Application:** Reunion ERP & Digital Ticketing Portal  
**Target Environments:** Production, Staging, Local Development  
**Standard:** W3C Content Security Policy Level 3  

---

## 1. Complete CSP Policy Directive Breakdown

The Content Security Policy for the application enforces strict boundaries while enabling necessary functionality for Supabase, PayStation Payment Gateway, Fontshare Typography, and Unsplash imagery.

```http
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline' https://api.fontshare.com;
  font-src 'self' https://api.fontshare.com https://cdn.fontshare.com data:;
  img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co https://hnthoszbkhvygoowtvau.supabase.co;
  connect-src 'self' https://*.supabase.co https://hnthoszbkhvygoowtvau.supabase.co wss://*.supabase.co wss://hnthoszbkhvygoowtvau.supabase.co https://api.paystation.com.bd https://sandbox.paystation.com.bd;
  frame-src 'self' https://api.paystation.com.bd https://sandbox.paystation.com.bd;
  object-src 'none';
  base-uri 'self';
  form-action 'self' https://api.paystation.com.bd https://sandbox.paystation.com.bd;
```

---

## 2. Directive Rationale & Allowances

| Directive | Configured Values | Justification & Security Impact |
| :--- | :--- | :--- |
| `default-src` | `'self'` | Denies all resource types by default unless explicitly permitted. Prevents fallback to open permissions. |
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval'` | Permits local Vite-bundled JavaScript chunks. `'unsafe-inline'` and `'unsafe-eval'` support Vite development HMR and minified runtime loaders. |
| `style-src` | `'self' 'unsafe-inline' https://api.fontshare.com` | Permits Tailwind CSS dynamic classes and Fontshare typography stylesheets. |
| `font-src` | `'self' https://api.fontshare.com https://cdn.fontshare.com data:` | Permits Clash Display & Satoshi web fonts from Fontshare CDN. |
| `img-src` | `'self' data: blob: https://images.unsplash.com https://*.supabase.co https://hnthoszbkhvygoowtvau.supabase.co` | Permits local assets, compressed canvas data URLs (<=200KB profile pictures), Unsplash hero images, and Supabase storage bucket photos. |
| `connect-src` | `'self' https://*.supabase.co https://hnthoszbkhvygoowtvau.supabase.co wss://*.supabase.co wss://hnthoszbkhvygoowtvau.supabase.co https://api.paystation.com.bd https://sandbox.paystation.com.bd` | Strictly permits REST API calls and WebSockets to Supabase project `hnthoszbkhvygoowtvau` and PayStation checkout APIs (Production & Sandbox). Blocks unauthorized data exfiltration. |
| `frame-src` | `'self' https://api.paystation.com.bd https://sandbox.paystation.com.bd` | Permits hosted PayStation payment checkout modaled views while blocking unauthorized third-party frames. |
| `object-src` | `'none'` | **Completely disables Flash, Java applets, and `<object>` / `<embed>` plugins.** Eliminates plugin-based code execution. |
| `base-uri` | `'self'` | Prevents malicious modification of the `<base href>` tag to hijack relative URL resolution. |
| `form-action` | `'self' https://api.paystation.com.bd https://sandbox.paystation.com.bd` | Restricts form submissions strictly to internal endpoints and official PayStation redirect gateways. |

---

## 3. Implementation in Source Code

### 3.1 HTML Meta Tag (`index.html`)
The policy is embedded directly in `<head>` so that all browser sessions immediately enforce CSP:

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://api.fontshare.com; font-src 'self' https://api.fontshare.com https://cdn.fontshare.com data:; img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co https://hnthoszbkhvygoowtvau.supabase.co; connect-src 'self' https://*.supabase.co https://hnthoszbkhvygoowtvau.supabase.co wss://*.supabase.co wss://hnthoszbkhvygoowtvau.supabase.co https://api.paystation.com.bd https://sandbox.paystation.com.bd; frame-src 'self' https://api.paystation.com.bd https://sandbox.paystation.com.bd; object-src 'none'; base-uri 'self'; form-action 'self' https://api.paystation.com.bd https://sandbox.paystation.com.bd;"
  />
  <meta http-equiv="X-Content-Type-Options" content="nosniff" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <title>Police Lines School & College Faridpur - Reunion 2026</title>
  ...
```

### 3.2 Vite Configuration (`vite.config.ts`)
Configured in Vite `server.headers` and `preview.headers` to provide defense-in-depth during development and preview testing:

```typescript
server: {
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  },
},
preview: {
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  },
}
```

---

## 4. Production Web Server Hardening (Deployment Guide)

When deploying to production reverse proxies, configure the full set of security headers:

### Nginx Configuration
```nginx
server {
    listen 443 ssl http2;
    server_name reunion.policelines.edu.bd;

    # Content Security Policy
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://api.fontshare.com; font-src 'self' https://api.fontshare.com https://cdn.fontshare.com data:; img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co https://hnthoszbkhvygoowtvau.supabase.co; connect-src 'self' https://*.supabase.co https://hnthoszbkhvygoowtvau.supabase.co wss://*.supabase.co wss://hnthoszbkhvygoowtvau.supabase.co https://api.paystation.com.bd https://sandbox.paystation.com.bd; frame-src 'self' https://api.paystation.com.bd https://sandbox.paystation.com.bd; object-src 'none'; base-uri 'self'; form-action 'self' https://api.paystation.com.bd https://sandbox.paystation.com.bd;" always;

    # Additional Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(self), microphone=(), geolocation=()" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    root /var/www/plsc-reunion/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Vercel / Netlify Configuration (`vercel.json` / `netlify.toml`)
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://api.fontshare.com; font-src 'self' https://api.fontshare.com https://cdn.fontshare.com data:; img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co https://hnthoszbkhvygoowtvau.supabase.co; connect-src 'self' https://*.supabase.co https://hnthoszbkhvygoowtvau.supabase.co wss://*.supabase.co wss://hnthoszbkhvygoowtvau.supabase.co https://api.paystation.com.bd https://sandbox.paystation.com.bd; frame-src 'self' https://api.paystation.com.bd https://sandbox.paystation.com.bd; object-src 'none'; base-uri 'self'; form-action 'self' https://api.paystation.com.bd https://sandbox.paystation.com.bd;"
        },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(self), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

