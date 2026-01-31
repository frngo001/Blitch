#!/bin/bash
set -ex

# Cache bust: 2026-01-31-v6
echo "Building CLSI with TeX Live at $(date)"
apt-get update

# Install additional tools (TeX Live is copied from texlive/texlive image)
apt-get install -y \
  poppler-utils \
  ghostscript \
  qpdf \
  perl

# Verify TeX Live is available
echo "=== Checking TeX Live installation ==="
echo "PATH is: $PATH"
echo ""
echo "TeX Live directory contents:"
ls -la /usr/local/texlive/ || { echo "ERROR: /usr/local/texlive not found!"; exit 1; }
echo ""
echo "Checking critical binaries:"
which latexmk && echo "✓ latexmk found" || { echo "✗ latexmk NOT found"; exit 1; }
which pdflatex && echo "✓ pdflatex found" || { echo "✗ pdflatex NOT found"; exit 1; }
which latex && echo "✓ latex found" || { echo "✗ latex NOT found"; exit 1; }
which bibtex && echo "✓ bibtex found" || echo "⚠ bibtex not found (optional)"
echo ""
echo "=== TeX Live verification complete ==="

rm -rf /var/lib/apt/lists/*

# Allow ImageMagick to process PDF files. This is for tests only, but since we
# use the production images for tests, this will apply to production as well.
patch /etc/ImageMagick-6/policy.xml <<EOF
--- old.xml	2022-03-23 09:16:03.985433900 -0400
+++ new.xml	2022-03-23 09:16:18.625471992 -0400
@@ -91,6 +91,5 @@
   <policy domain="coder" rights="none" pattern="PS2" />
   <policy domain="coder" rights="none" pattern="PS3" />
   <policy domain="coder" rights="none" pattern="EPS" />
-  <policy domain="coder" rights="none" pattern="PDF" />
   <policy domain="coder" rights="none" pattern="XPS" />
 </policymap>
EOF
