# Python resume reader

Used by HR > Recruitment > "Add candidate from resume". Node runs `resume_parser.py` automatically;
if Python is missing it falls back to the JavaScript reader.

## Setup (once, on the server)
    cd backend/hr/python
    pip install -r requirements.txt

* Python 3.9+ must be on PATH (`python3`, `python` or `py`). To force one, set `PYTHON_BIN` in backend/.env.
* Scanned PDFs / photos of resumes need the **Tesseract** program (Ubuntu: `apt install tesseract-ocr`,
  Windows: the UB-Mannheim installer, then add it to PATH). Normal PDF / Word resumes do not need it.

## Check it
    python test_resume_parser.py                 # layout tests
    python resume_parser.py some_resume.pdf      # prints the JSON the screen receives
