#!/usr/bin/env bash
echo "🚀 Déploiement de MovieZ sur Vercel..."
cd "$(dirname "$0")"
npx --yes vercel
