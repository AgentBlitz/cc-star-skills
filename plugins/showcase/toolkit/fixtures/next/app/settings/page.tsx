"use client";
import { useEffect, useState } from "react";

const KEY = "orbit:digest";

export default function Settings() {
  const [digest, setDigest] = useState(false);
  useEffect(() => setDigest(window.localStorage.getItem(KEY) === "on"), []);
  return (
    <section>
      <h1>Settings</h1>
      <label>
        <input
          type="checkbox"
          checked={digest}
          onChange={(e) => {
            setDigest(e.target.checked);
            window.localStorage.setItem(KEY, e.target.checked ? "on" : "off");
          }}
        />{" "}
        Weekly digest
      </label>
      <p role="status">{digest ? "The digest arrives every Monday." : "No digest yet."}</p>
    </section>
  );
}
