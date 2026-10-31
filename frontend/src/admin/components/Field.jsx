export default function Field({ label, ...props }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
