"use client";
import { type FormEvent, useEffect, useState } from "react";

const KEY = "orbit:projects";
const START = ["Website refresh", "Quarterly review"];

export default function Projects() {
  const [projects, setProjects] = useState<string[]>(START);
  const [name, setName] = useState("");
  useEffect(() => {
    const kept = window.localStorage.getItem(KEY);
    if (kept) setProjects(JSON.parse(kept) as string[]);
  }, []);
  const add = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const next = [...projects, n];
    setProjects(next);
    window.localStorage.setItem(KEY, JSON.stringify(next));
    setName("");
  };
  return (
    <section>
      <h1>Projects</h1>
      <ul aria-label="Projects">
        {projects.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <form onSubmit={add}>
        <label>
          Project name <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit">Add project</button>
      </form>
    </section>
  );
}
