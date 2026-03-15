#!/bin/bash
echo "=== [1] Client SDK en services/ (debe estar vacio) ==="
grep -rn "from 'firebase'" src/services/ 2>/dev/null | grep -v "firebase-admin" && echo "⚠️  PROBLEMA ENCONTRADO" || echo "✅ OK"

echo "=== [2] Client SDK en API routes (debe estar vacio) ==="
grep -rn "from 'firebase'" src/app/api/ 2>/dev/null | grep -v "firebase-admin" && echo "⚠️  PROBLEMA ENCONTRADO" || echo "✅ OK"

echo "=== [3] Admin SDK en componentes (debe estar vacio) ==="
grep -rn "firebase-admin" src/components/ 2>/dev/null && echo "⚠️  PROBLEMA ENCONTRADO" || echo "✅ OK"

echo "=== [4] Admin SDK en hooks (debe estar vacio) ==="
grep -rn "firebase-admin" src/hooks/ 2>/dev/null && echo "⚠️  PROBLEMA ENCONTRADO" || echo "✅ OK"

echo ""
echo "Si todos los grupos dicen OK -> seguro hacer push."
