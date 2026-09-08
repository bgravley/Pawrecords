#!/usr/bin/env python3
from pathlib import Path

app = Path('src/App.jsx')
text = app.read_text(encoding='utf-8')

old_imports = '''import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import Auth from "./components/Auth.jsx";
import Marketing from "./Marketing.jsx";
import YourPetPass from "./PawRecord.jsx";
import Admin from "./Admin.jsx";
import Emergency from "./Emergency.jsx";
import Travel from "./Travel.jsx";
import AffiliatePortal from "./AffiliatePortal.jsx";
'''
new_imports = '''import { useState, useEffect, lazy } from "react";
import { supabase } from "./lib/supabase";
import Marketing from "./Marketing.jsx";
'''
if text.count(old_imports) != 1:
    raise SystemExit(f'expected App import block exactly once, found {text.count(old_imports)}')
text = text.replace(old_imports, new_imports, 1)

anchor = '''} from "./lib/legalAttestation.js";
'''
lazy_block = '''} from "./lib/legalAttestation.js";

// Route-like surfaces are loaded only when a visitor actually opens them.
// Marketing stays eager so the public homepage remains the fastest first paint.
const Auth = lazy(() => import("./components/Auth.jsx"));
const YourPetPass = lazy(() => import("./PawRecord.jsx"));
const Admin = lazy(() => import("./Admin.jsx"));
const Emergency = lazy(() => import("./Emergency.jsx"));
const Travel = lazy(() => import("./Travel.jsx"));
const AffiliatePortal = lazy(() => import("./AffiliatePortal.jsx"));
'''
if text.count(anchor) != 1:
    raise SystemExit(f'expected legalAttestation import anchor once, found {text.count(anchor)}')
text = text.replace(anchor, lazy_block, 1)
app.write_text(text, encoding='utf-8')

main = Path('src/main.jsx')
text = main.read_text(encoding='utf-8')
old = '''    <AppErrorBoundary>\n      <App />\n    </AppErrorBoundary>'''
new = '''    <AppErrorBoundary>\n      <React.Suspense fallback={\n        <div style={{ minHeight: '100vh', background: '#FAFCFB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2C4A38', fontFamily: "'Lora', serif", fontWeight: 700 }}>\n          🐾 Loading YourPetPass...\n        </div>\n      }>\n        <App />\n      </React.Suspense>\n    </AppErrorBoundary>'''
if text.count(old) != 1:
    raise SystemExit(f'expected AppErrorBoundary render anchor once, found {text.count(old)}')
text = text.replace(old, new, 1)
main.write_text(text, encoding='utf-8')
print('route code-splitting patch applied')
