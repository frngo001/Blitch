#!/bin/bash
set -ex

# Cache bust: 2026-01-31-v2
apt-get update

# Install TeX Live (base + recommended packages for common LaTeX documents)
# Using smaller packages instead of texlive-full to fit build time limits
apt-get install -y \
  poppler-utils \
  ghostscript \
  texlive-latex-base \
  texlive-latex-recommended \
  texlive-latex-extra \
  texlive-fonts-recommended \
  texlive-fonts-extra \
  texlive-science \
  texlive-pictures \
  texlive-bibtex-extra \
  latexmk \
  qpdf

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
