export default function TestPage() {
  return (
    <div style={{ padding: '50px', fontSize: '24px' }}>
      <h1>✅ Next.js is working!</h1>
      <p>Server time: {new Date().toISOString()}</p>
      <a href="/login">Go to Login</a>
    </div>
  );
}
