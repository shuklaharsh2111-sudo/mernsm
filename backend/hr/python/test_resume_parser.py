"""Run:  python test_resume_parser.py     (checks the parser against tricky resume layouts)"""
import sys
from resume_parser import parse_resume

CASES = [
    ("simple", "Priya Sharma\nSenior Graphic Designer\nPhone: +91 98765 43210 | Email: priya.sharma@gmail.com\nMumbai, India\nSUMMARY\nCreative designer...",
     ("Priya Sharma", "9876543210", "priya.sharma@gmail.com", "Senior Graphic Designer")),
    ("objective", "RAHUL VERMA\nE-mail : rahul.v@outlook.com\nMob: 9876543210\nCAREER OBJECTIVE\nSeeking a position as Digital Marketing Executive in a reputed firm.\nEXPERIENCE\nSocial Media Manager - ABC Pvt Ltd (2021-2023)",
     ("Rahul Verma", "9876543210", "rahul.v@outlook.com", "Digital Marketing Executive")),
    ("labels", "Curriculum Vitae\nAnkit Joshi\nContact No.: (+91) 91234-56789\nankit.joshi@yahoo.in\nApplying for: Video Editor",
     ("Ankit Joshi", "9123456789", "ankit.joshi@yahoo.in", "Video Editor")),
    ("company_after_title", "SNEHA PATIL\n+91-9988776655\nsneha@x.com\nWORK EXPERIENCE\nContent Writer, XYZ Media\nJan 2022 - Present\nEDUCATION\nB.Com",
     ("Sneha Patil", "9988776655", "sneha@x.com", "Content Writer")),
    ("uiux", "Mohammed Faisal Khan\nUI/UX Designer\nfaisal@mail.com   |   +91 99 8877 6655\nLinkedIn: linkedin.com/in/faisal",
     ("Mohammed Faisal Khan", "9988776655", "faisal@mail.com", "UI/UX Designer")),
    ("form_labels", "Name: Kavita Rao\nDesignation: Accountant\nMobile Number: 98200 12345\nEmail ID: kavita.rao@gmail.com",
     ("Kavita Rao", "9820012345", "kavita.rao@gmail.com", "Accountant")),
    ("summary_sentence", "Aarav Mehta\nContact\n+91 98 2000 1234\naarav@x.com\nPROFILE\nFrontend Developer with 3 years experience",
     ("Aarav Mehta", "9820001234", "aarav@x.com", "Frontend Developer")),
    ("landline_and_mobile", "Sunil Shah\nAccountant\nTel: 022-2456 7890   Mob: 98200 98200\nsunil@x.com",
     ("Sunil Shah", "9820098200", "sunil@x.com", "Accountant")),
    ("one_flat_line", "PRIYA SHARMA Graphic Designer +91 98765 43210 priya.sharma@gmail.com Mumbai, India",
     ("Priya Sharma", "9876543210", "priya.sharma@gmail.com", "Graphic Designer")),
    ("pipes", "Priya Sharma | Graphic Designer | 9876543210 | priya@x.com",
     ("Priya Sharma", "9876543210", "priya@x.com", "Graphic Designer")),
    ("pincode_and_years", "Rahul Nair\nFlat 4, Andheri West, Mumbai 400053 9820098200\n2019 - 2021 B.Com\nrahul.nair@gmail.com\nCareer Objective: To work as a Social Media Executive",
     ("Rahul Nair", "9820098200", "rahul.nair@gmail.com", "Social Media Executive")),
    ("spaced_caps", "P R I Y A   S H A R M A\nUI/UX DESIGNER\n+91-98200-98200\npriya@x.com",
     ("Priya Sharma", "9820098200", "priya@x.com", "UI/UX Designer")),
    ("international", "John Smith\nSoftware Engineer\n+1 (415) 555-2671\njohn.smith@gmail.com",
     ("John Smith", "+14155552671", "john.smith@gmail.com", "Software Engineer")),
    ("no_title_anywhere", "Ravi Kumar\nravi.kumar@gmail.com\n9876501234\nEDUCATION\nBBA, Pune University\nSKILLS\nExcel, Tally",
     ("Ravi Kumar", "9876501234", "ravi.kumar@gmail.com", "")),
    ("phone_glued_to_email", "Anita Desai\nGraphic Designer\nMobile:9820098200anita.desai@gmail.com",
     ("Anita Desai", "9820098200", "anita.desai@gmail.com", "Graphic Designer")),
    ("resume_of", "RESUME OF Pooja Iyer\nDesignation: Digital Marketing Executive\n+91 99887 76655\npooja.iyer@gmail.com",
     ("Pooja Iyer", "9988776655", "pooja.iyer@gmail.com", "Digital Marketing Executive")),
    ("first_job", "Karan Malhotra\n+91 9988776655 | karan@x.com\nWORK EXPERIENCE\nSenior Video Editor — Bright Studio\n2020 - Present\nEDUCATION\nBA",
     ("Karan Malhotra", "9988776655", "karan@x.com", "Senior Video Editor")),
    ("icon_glyphs", "\uf095 +91 98765 43210\n\uf0e0 sam.thomas@gmail.com\nSAM THOMAS\nCopywriter",
     ("Sam Thomas", "9876543210", "sam.thomas@gmail.com", "Copywriter")),
    ("glued_tld", "Meera Rao\nmeera@gmail.comPhone 9876543210\nContent Writer",
     ("Meera Rao", "9876543210", "meera@gmail.com", "Content Writer")),
    ("project_manager_not_section", "Deepak Jain\nProject Manager\n9811122233\ndeepak.jain@gmail.com",
     ("Deepak Jain", "9811122233", "deepak.jain@gmail.com", "Project Manager")),
    ("first_last_on_two_lines", "RIYA\nMEHTA\nSOCIAL MEDIA MANAGER\nM: +91 99887 76655   E: riya.mehta@gmail.com\nPROFILE\nCreative marketer.",
     ("Riya Mehta", "9988776655", "riya.mehta@gmail.com", "Social Media Manager")),
    ("three_part_name_two_lines", "AISHA\nFATIMA KHAN\nWeb Developer\n+91 91234 56780 aisha.khan@gmail.com",
     ("Aisha Fatima Khan", "9123456780", "aisha.khan@gmail.com", "Web Developer")),
    ("tagline_above_name", "Design. Create. Inspire.\nTanvi Joshi\nGraphic Designer\n+91 9811122233 tanvi.joshi@gmail.com",
     ("Tanvi Joshi", "9811122233", "tanvi.joshi@gmail.com", "Graphic Designer")),
    ("honorific", "Mr. Suresh Menon\nSales Executive\nMobile No: 9867012345  Email: suresh.menon@gmail.com",
     ("Suresh Menon", "9867012345", "suresh.menon@gmail.com", "Sales Executive")),
    ("degree_after_name", "Rohit K. Patil, MBA\nBusiness Development & Sales Manager\n9988776655 | rohit.patil@company.in",
     ("Rohit K. Patil", "9988776655", "rohit.patil@company.in", "Business Development & Sales Manager")),
    ("no_name_text_title_only", "Fashion Designer\n9004455667   dhara.shah@gmail.com",
     ("Dhara Shah", "9004455667", "dhara.shah@gmail.com", "Fashion Designer")),
    ("unusual_title_under_name", "Ankit Joshi\nVisual Storyteller\n9123456789 | ankit.j@gmail.com",
     ("Ankit Joshi", "9123456789", "ankit.j@gmail.com", "Visual Storyteller")),
    ("title_with_unknown_words", "Mohit Rao\nAI Prompt Engineer\n9811122233 | mohit.rao@gmail.com",
     ("Mohit Rao", "9811122233", "mohit.rao@gmail.com", "AI Prompt Engineer")),
    ("title_beside_name", "Dev Malhotra     Motion Designer\n9004455667 | dev.m@gmail.com",
     ("Dev Malhotra", "9004455667", "dev.m@gmail.com", "Motion Designer")),
    ("big_name_tiny_student_line", "SHREYA\nMEDIA STUDENT\n+91 98200 12345 | shreya.k@gmail.com",
     ("Shreya", "9820012345", "shreya.k@gmail.com", "Media Student")),
    ("student_title_after_contacts", "SHREYA KAPOOR\n+91 98200 12345\nshreya.k@gmail.com\nMEDIA STUDENT\nEDUCATION\nBA Mass Media",
     ("Shreya Kapoor", "9820012345", "shreya.k@gmail.com", "Media Student")),
    ("title_wraps_after_ampersand", "Priya Sharma\nGraphic Designer &\nVideo editor\n9876543210 | p@x.com",
     ("Priya Sharma", "9876543210", "p@x.com", "Graphic Designer & Video Editor")),
    ("title_wraps_ampersand_next_line", "Priya Sharma\nGraphic Designer\n& Video Editor\n9876543210 | p@x.com",
     ("Priya Sharma", "9876543210", "p@x.com", "Graphic Designer & Video Editor")),
    ("dob_not_phone", "Nisha Verma\nHR Executive\nDOB: 12/05/1998\n+91 9090909090\nnisha.v@gmail.com",
     ("Nisha Verma", "9090909090", "nisha.v@gmail.com", "HR Executive")),
]

bad = 0
for name, text, want in CASES:
    f = parse_resume(text, "resume.pdf")
    got = (f["name"], f["mobile"], f["email"], f["position"])
    ok = got == want
    bad += not ok
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else "\n   got : %s\n   want: %s" % (got, want)))
print("\n%d/%d passed" % (len(CASES) - bad, len(CASES)))
sys.exit(1 if bad else 0)
