function formatDate(value) {
  if (!value) return "____________";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const ROWS_PER_PAGE = 28;

function chunkRows(rows, size) {
  if (!rows.length) return [[]];
  const pages = [];
  for (let i = 0; i < rows.length; i += size) {
    pages.push(rows.slice(i, i + size));
  }
  return pages;
}

/**
 * Printable student list sheet — logo centered, ~28 rows per printed page.
 */
function StudentListSheet({
  organization,
  className,
  sectionName,
  students = [],
  title = "Student List",
  session = "",
  subject = "",
  exam = "",
  listDate = "",
  totalMarks = "",
  pageBreakAfter = false,
}) {
  const orgName = organization?.name?.trim() || "Institute";
  const logoUrl = organization?.logo?.trim() || null;
  const address = organization?.address?.trim() || null;
  const phone = organization?.phone?.trim() || null;

  const listRef = (() => {
    const classPart = String(className || "CLASS").replace(/\s+/g, "").toUpperCase();
    const sectionPart = String(sectionName || "SEC").replace(/\s+/g, "").toUpperCase();
    const datePart = String(listDate || "").replaceAll("-", "");
    return `${classPart}-${sectionPart}-${datePart || "DATE"}`;
  })();

  const pages = chunkRows(students, ROWS_PER_PAGE);

  return (
    <>
      {pages.map((pageStudents, pageIndex) => {
        const isLastPage = pageIndex === pages.length - 1;
        const breakAfter = !isLastPage || pageBreakAfter;
        const startSr = pageIndex * ROWS_PER_PAGE;

        return (
          <article
            key={`page-${pageIndex}`}
            className={["student-list-sheet", breakAfter ? "student-list-page-break" : ""].join(
              " "
            )}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="exam-watermark" aria-hidden />
            ) : null}

            <header className="exam-brand-header">
              <div className="exam-brand-center-stack">
                <div className="exam-brand-logo exam-brand-logo--center">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="exam-logo-img" />
                  ) : (
                    <div className="exam-logo-fallback" aria-hidden>
                      {(orgName.slice(0, 2) || "IN").toUpperCase()}
                    </div>
                  )}
                </div>
                <h1 className="exam-org-name">{orgName}</h1>
                {address ? (
                  <p className="exam-org-address">HEAD OFFICE: {address.toUpperCase()}</p>
                ) : null}
                {phone ? <p className="exam-org-phone">Ph: {phone}</p> : null}
              </div>
            </header>

            <div className="student-list-title-block">
              <h2 className="student-list-title">{title.trim() || "Student List"}</h2>
              <p className="student-list-ref">
                List Ref: {listRef}
                {pages.length > 1 ? ` · Page ${pageIndex + 1} of ${pages.length}` : ""}
              </p>
            </div>

            <div className="student-list-meta">
              <div>
                <span>Class</span>
                <strong>{className}</strong>
              </div>
              <div>
                <span>Section</span>
                <strong>{sectionName}</strong>
              </div>
              <div>
                <span>Session</span>
                <strong>{session || "____________"}</strong>
              </div>
              <div>
                <span>Subject</span>
                <strong>{subject.trim() || "____________"}</strong>
              </div>
              <div>
                <span>Exam</span>
                <strong>{exam.trim() || "____________"}</strong>
              </div>
              <div>
                <span>Date</span>
                <strong>{formatDate(listDate)}</strong>
              </div>
              <div>
                <span>Students</span>
                <strong>{students.length}</strong>
              </div>
              <div>
                <span>Total marks</span>
                <strong>{totalMarks.trim() || "____________"}</strong>
              </div>
            </div>

            {pageStudents.length === 0 ? (
              <p className="student-list-empty">No active students in this section.</p>
            ) : (
              <table className="student-list-table">
                <thead>
                  <tr>
                    <th className="col-sr">Sr.</th>
                    <th className="col-roll">Roll No.</th>
                    <th className="col-name">Student Name</th>
                    <th className="col-father">Father Name</th>
                    <th className="col-obt">Obt. Marks</th>
                    <th className="col-total">Total Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {pageStudents.map((student, index) => (
                    <tr key={student._id || `${student.rollNumber}-${startSr + index}`}>
                      <td className="col-sr">{startSr + index + 1}</td>
                      <td className="col-roll">{student.rollNumber}</td>
                      <td className="col-name">{student.name}</td>
                      <td className="col-father">{student.fatherName}</td>
                      <td className="col-obt" />
                      <td className="col-total">{totalMarks.trim()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {isLastPage ? (
              <footer className="student-list-sign">
                <div>
                  <span />
                  <p>Class Teacher</p>
                </div>
                <div>
                  <span />
                  <p>Checked By</p>
                </div>
                <div>
                  <span />
                  <p>Principal</p>
                </div>
              </footer>
            ) : (
              <p className="student-list-continued">Continued on next page…</p>
            )}
          </article>
        );
      })}
    </>
  );
}

export default StudentListSheet;
export { formatDate, ROWS_PER_PAGE };
