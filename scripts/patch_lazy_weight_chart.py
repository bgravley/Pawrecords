#!/usr/bin/env python3
from pathlib import Path
import re

paw = Path('src/PawRecord.jsx')
text = paw.read_text(encoding='utf-8')

react_old = 'import { useReducer, useState, useEffect, useRef, Component } from "react";'
react_new = 'import { useReducer, useState, useEffect, useRef, Component, lazy, Suspense } from "react";'
if text.count(react_old) != 1:
    raise SystemExit(f'expected React import exactly once, found {text.count(react_old)}')
text = text.replace(react_old, react_new, 1)

recharts_import = 'import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";\n'
if text.count(recharts_import) != 1:
    raise SystemExit(f'expected Recharts import exactly once, found {text.count(recharts_import)}')
text = text.replace(recharts_import, '', 1)

anchor = 'import { createScanImagePayload, MAX_SCAN_REQUEST_BYTES, readScanResponse, SCAN_RETRY_MESSAGE, scanRequestSize } from "./lib/aiScanPayload";\n'
lazy_decl = anchor + '\nconst WeightHistoryChart = lazy(() => import("./WeightHistoryChart.jsx"));\n'
if text.count(anchor) != 1:
    raise SystemExit(f'expected AI scan import anchor exactly once, found {text.count(anchor)}')
text = text.replace(anchor, lazy_decl, 1)

pattern = re.compile(
    r'\{weights\.length>=2&&\(<Card><div style=\{\{width:"100%",height:180\}\}>'
    r'(?P<chart><ResponsiveContainer.*?</ResponsiveContainer>)'
    r'</div></Card>\)\}',
    re.S,
)
match = pattern.search(text)
if not match:
    raise SystemExit('could not locate the existing weight-history chart block')
chart = match.group('chart')
if text.count(match.group(0)) != 1:
    raise SystemExit('weight-history chart block is not unique')

replacement = '''{weights.length>=2&&(<Card>
      <Suspense fallback={<div role="status" style={{height:180,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#6A8372"}}>Loading weight history...</div>}>
        <WeightHistoryChart weights={weights}/>
      </Suspense>
    </Card>)}'''
text = text[:match.start()] + replacement + text[match.end():]
paw.write_text(text, encoding='utf-8')

chart_file = Path('src/WeightHistoryChart.jsx')
if chart_file.exists():
    raise SystemExit('src/WeightHistoryChart.jsx already exists')
chart_file.write_text(
    '''import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";\n\nexport default function WeightHistoryChart({ weights }) {\n  return (\n    <div style={{width:"100%",height:180}}>\n      ''' + chart + '''\n    </div>\n  );\n}\n''',
    encoding='utf-8',
)
print('lazy weight-history chart patch applied')
