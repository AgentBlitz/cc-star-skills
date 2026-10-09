import Link from "next/link";

export default function Home() {
  return (
    <section>
      <h1>Welcome to Orbit</h1>
      <p>Every project your team runs, in one calm place.</p>
      <p>
        <Link href="/?showcase=next-tour">Take the tour</Link>
      </p>
    </section>
  );
}
