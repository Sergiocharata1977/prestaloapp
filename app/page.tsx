import Image from 'next/image';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Image
          className={styles.logo}
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <ol className={styles.list}>
          <li>
            Edita <code>app/page.tsx</code>.
          </li>
          <li>Haz deploy en Vercel y verifica que la portada renderice.</li>
        </ol>
        <div className={styles.ctaRow}>
          <a
            className={styles.buttonPrimary}
            href="https://vercel.com/new"
            target="_blank"
            rel="noreferrer"
          >
            Deploy now
          </a>
          <a
            className={styles.buttonSecondary}
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noreferrer"
          >
            Read docs
          </a>
        </div>
      </main>
      <footer className={styles.footer}>
        <a
          className={styles.footerLink}
          href="https://nextjs.org/learn"
          target="_blank"
          rel="noreferrer"
        >
          <Image src="/file.svg" alt="" width={16} height={16} />
          Learn
        </a>
        <a
          className={styles.footerLink}
          href="https://vercel.com/templates"
          target="_blank"
          rel="noreferrer"
        >
          <Image src="/window.svg" alt="" width={16} height={16} />
          Examples
        </a>
        <a
          className={styles.footerLink}
          href="https://vercel.com"
          target="_blank"
          rel="noreferrer"
        >
          <Image src="/vercel.svg" alt="Vercel logo" width={16} height={16} />
          Go to Vercel
        </a>
      </footer>
    </div>
  );
}
