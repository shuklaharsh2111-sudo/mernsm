/* Closing block of the monthly report: prepared by + report manager, each with a signature line, and the date. */
const Sign = ({ role, name, position, date }) => (
    <div className="mr-sign-box">
        <span className="mr-sign-role">{role}</span>
        <div className="mr-sign-line" />
        <strong>{name || '\u00a0'}</strong>
        {position && <small>{position}</small>}
        <em>Date: {date}</em>
    </div>
);

const ReportSignature = ({ preparedBy, position, manager, date }) => (
    <div className="mr-sign">
        <Sign role="Prepared by" name={preparedBy} position={position} date={date} />
        <Sign role="Report Manager" name={manager} position="Reporting Manager" date={date} />
    </div>
);

export default ReportSignature;
