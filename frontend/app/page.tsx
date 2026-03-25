"use client";

import { useEffect, useState } from "react";

export default function TestBackend() {
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/health`)
      .then((res) => res.json())
      .then((data) => setStatus(JSON.stringify(data)))
      .catch((err) => setStatus("Erreur: " + err.message));
  }, []);

  return (
    <div>
      <h1>Test Backend</h1>
      <pre>{status}</pre>
    </div>
  );
}
