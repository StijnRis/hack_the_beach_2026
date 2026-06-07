import React from 'react';
import CameraScanner from '../components/camera-scanner'; // Adjust this import path to match your file structure
import HomePage from '@/app/page'; // Adjust this import path to match where your HomePage is located

export default function ScannerPage(): React.JSX.Element {
    return (
        <div style={styles.pageLayout}>
            {/* Camera Scanner Viewport */}
            <section style={styles.scannerSection}>
                <CameraScanner />
            </section>

            {/* Home Page Content stacked below */}
            <section style={styles.homeSection}>
                <HomePage />
            </section>
        </div>
    );
}

const styles: { [key: string]: React.CSSProperties } = {
    pageLayout: {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: '#0b0f19', // Matches your Home Page theme background
    },
    scannerSection: {
        width: '100%',
        position: 'relative',
        zIndex: 10,
    },
    homeSection: {
        width: '100%',
        position: 'relative',
        zIndex: 1,
    }
};