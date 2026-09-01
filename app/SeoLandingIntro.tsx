import styles from "./SeoCollectionIntro.module.css";

export default function SeoLandingIntro({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <section className={styles.section} aria-labelledby="seo-landing-title">
      <h1 id="seo-landing-title">{title}</h1>
      <p>{description}</p>
    </section>
  );
}
