import React from 'react';
import Link from 'next/link';

export default function HomePage(): React.JSX.Element {
    return (
        <div style={styles.container}>
            {/* Header */}
            <header style={styles.header}>
                <div style={styles.logo}>SustainScan</div>
                <nav style={styles.navLinks}>
                    <a href="#mission" style={styles.navLink}>Our Mission</a>
                    <a href="#features" style={styles.navLink}>How It Works</a>
                </nav>
            </header>

            {/* Hero Section */}
            <section style={styles.hero}>
                <h1 style={styles.title}>
                    Scan the aisle. <span style={styles.gradientText}>Reveal the impact.</span>
                </h1>
                <p style={styles.subtitle}>
                    Snap a single photo of any grocery shelf to instantly identify products
                    and uncover their true sustainability, ethical, and social footprint.
                </p>
                <div style={styles.ctaGroup}>
                    <Link href="/scanner" style={styles.primaryBtn}>
                        Open Camera Scanner
                    </Link>
                    <a href="#mission" style={styles.secondaryBtn}>Read Our Mission</a>
                </div>
            </section>

            {/* Features Grid Section */}
            <section id="features" style={styles.featuresSection}>
                <h2 style={styles.sectionTitle}>Empowering Ethical Choices in Real-Time</h2>
                <div style={styles.grid}>
                    <div style={styles.card}>
                        <div style={styles.icon}>📸</div>
                        <h3 style={styles.cardTitle}>Instant Aisle Detection</h3>
                        <p style={styles.cardText}>
                            No more tedious barcode scanning. Capture an entire shelf at once to catalog every product in your view simultaneously.
                        </p>
                    </div>

                    <div style={styles.card}>
                        <div style={styles.icon}>🌍</div>
                        <h3 style={styles.cardTitle}>Social Impact Scoring</h3>
                        <p style={styles.cardText}>
                            Look beyond the label. Track fair-wage certifications, ethical supply chains, and corporate social responsibility metrics instantly.
                        </p>
                    </div>

                    <div style={styles.card}>
                        <div style={styles.icon}>🌱</div>
                        <h3 style={styles.cardTitle}>Sustainability Metrics</h3>
                        <p style={styles.cardText}>
                            Evaluate carbon offsets, local sourcing data, and packaging waste scores to support brands prioritizing the planet.
                        </p>
                    </div>
                </div>
            </section>

            {/* Mission Section (Emphasizing Social Impact) */}
            <section id="mission" style={styles.missionSection}>
                <div style={styles.missionContent}>
                    <h2 style={styles.missionTitle}>Voting with your wallet matters.</h2>
                    <p style={styles.missionText}>
                        Every product we buy channels resources back into global supply chains. By unmasking
                        the hidden social and environmental footprint behind grocery brands, we transform
                        everyday shopping into an actionable tool for systemic change and corporate accountability.
                    </p>
                </div>
            </section>

            {/* Footer */}
            <footer style={styles.footer}>
                <p>© {new Date().getFullYear()} SustainScan. Driving transparent consumerism through technology.</p>
            </footer>
        </div>
    );
}

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        color: '#f9fafb',
        backgroundColor: '#0b0f19',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        margin: 0,
        padding: 0,
        boxSizing: 'border-box',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.5rem 2rem',
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
    },
    logo: {
        fontSize: '1.25rem',
        fontWeight: 700,
        letterSpacing: '-0.025em',
        color: '#ffffff',
    },
    navLinks: {
        display: 'flex',
        gap: '1.5rem',
    },
    navLink: {
        color: '#9ca3af',
        textDecoration: 'none',
        fontSize: '0.95rem',
        fontWeight: 500,
    },
    hero: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '6rem 1.5rem',
        maxWidth: '850px',
        margin: '0 auto',
        flex: 1,
    },
    title: {
        fontSize: '3.5rem',
        fontWeight: 800,
        lineHeight: 1.15,
        letterSpacing: '-0.04em',
        marginBottom: '1.5rem',
        color: '#ffffff',
    },
    gradientText: {
        background: 'linear-gradient(to right, #34d399, #60a5fa)', // Eco-friendly green to clear tech blue
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    subtitle: {
        fontSize: '1.25rem',
        color: '#9ca3af',
        lineHeight: 1.6,
        marginBottom: '2.5rem',
        maxWidth: '650px',
    },
    ctaGroup: {
        display: 'flex',
        gap: '1rem',
        alignItems: 'center',
    },
    primaryBtn: {
        backgroundColor: '#34d399', // Swapped button accent color to dynamic sustainability green
        color: '#0b0f19',
        padding: '0.75rem 1.5rem',
        borderRadius: '0.5rem',
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        fontSize: '1rem',
        textDecoration: 'none',
        display: 'inline-block',
        boxShadow: '0 4px 14px rgba(52, 211, 153, 0.25)',
    },
    secondaryBtn: {
        backgroundColor: 'transparent',
        color: '#f9fafb',
        padding: '0.75rem 1.5rem',
        borderRadius: '0.5rem',
        fontWeight: 600,
        border: '1px solid #374151',
        cursor: 'pointer',
        fontSize: '1rem',
        textDecoration: 'none',
    },
    featuresSection: {
        backgroundColor: '#111827',
        padding: '5rem 2rem',
        borderTop: '1px solid #1f2937',
    },
    sectionTitle: {
        textAlign: 'center',
        fontSize: '2rem',
        fontWeight: 700,
        marginBottom: '3rem',
        letterSpacing: '-0.025em',
        color: '#ffffff',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '2rem',
        maxWidth: '1200px',
        margin: '0 auto',
    },
    card: {
        backgroundColor: '#1f2937',
        padding: '2rem',
        borderRadius: '0.75rem',
        border: '1px solid #374151',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
    },
    icon: {
        fontSize: '2rem',
        marginBottom: '1rem',
    },
    cardTitle: {
        fontSize: '1.25rem',
        fontWeight: 600,
        marginBottom: '0.5rem',
        color: '#ffffff',
    },
    cardText: {
        color: '#9ca3af',
        lineHeight: 1.5,
        fontSize: '0.95rem',
    },
    missionSection: {
        backgroundColor: '#0b0f19',
        padding: '5rem 2rem',
        borderTop: '1px solid #1f2937',
        display: 'flex',
        justifyContent: 'center',
    },
    missionContent: {
        maxWidth: '750px',
        textAlign: 'center',
    },
    missionTitle: {
        fontSize: '1.75rem',
        fontWeight: 700,
        marginBottom: '1.25rem',
        color: '#ffffff',
    },
    missionText: {
        color: '#9ca3af',
        lineHeight: 1.7,
        fontSize: '1.1rem',
    },
    footer: {
        textAlign: 'center',
        padding: '2rem',
        backgroundColor: '#0b0f19',
        borderTop: '1px solid #1f2937',
        color: '#4b5563',
        fontSize: '0.875rem',
    },
};