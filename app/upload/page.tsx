"use client";

import { ChangeEvent, FormEvent, useState } from "react";

export default function ProductDetectionPage() {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [result, setResult] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Handle image selection and generate a preview
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            // Clear previous outputs
            setResult(null);
            setError(null);
        }
    };

    // Submit form data to the API route
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!file) {
            setError("Please select an image first.");
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        const formData = new FormData();
        // Your backend expects the field name to be 'image'
        formData.append("image", file);

        try {
            // Replace '/api/detect' with the actual path to your API route file
            const response = await fetch("/api/pipeline", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();
            setResult(data);

            if (!response.ok) {
                setError(data.error || "Something went wrong on the server.");
            }
        } catch (err: any) {
            setError(err.message || "Failed to connect to the server.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                maxWidth: "800px",
                margin: "2rem auto",
                padding: "0 1rem",
                fontFamily: "sans-serif",
            }}
        >
            <h2>Product Detection Pipeline</h2>
            <p style={{ color: "#666" }}>
                Upload an image to trigger the detection model and view the raw
                pipeline output.
            </p>

            <form
                onSubmit={handleSubmit}
                style={{
                    marginBottom: "2rem",
                    border: "1px dashed #ccc",
                    padding: "1.5rem",
                    borderRadius: "8px",
                }}
            >
                <div style={{ marginBottom: "1rem" }}>
                    <label
                        htmlFor="image-upload"
                        style={{
                            display: "block",
                            marginBottom: "0.5rem",
                            fontWeight: "bold",
                        }}
                    >
                        Select Product Image:
                    </label>
                    <input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={loading}
                    />
                </div>

                {/* Local Image Preview */}
                {previewUrl && (
                    <div style={{ marginBottom: "1rem" }}>
                        <p
                            style={{
                                fontSize: "0.85rem",
                                margin: "0 0 0.5rem 0",
                                color: "#555",
                            }}
                        >
                            Image Preview:
                        </p>
                        <img
                            src={previewUrl}
                            alt="Preview"
                            style={{
                                maxHeight: "200px",
                                borderRadius: "4px",
                                border: "1px solid #ddd",
                            }}
                        />
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || !file}
                    style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: loading ? "#ccc" : "#0070f3",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: loading ? "not-allowed" : "pointer",
                        fontWeight: "bold",
                    }}
                >
                    {loading ? "Processing Pipeline..." : "Run Detection"}
                </button>
            </form>

            <hr
                style={{
                    border: "0",
                    borderTop: "1px solid #eee",
                    margin: "2rem 0",
                }}
            />

            {/* Error Presentation */}
            {error && (
                <div
                    style={{
                        padding: "1rem",
                        backgroundColor: "#fff5f5",
                        color: "#c53030",
                        borderRadius: "4px",
                        marginBottom: "1rem",
                        border: "1px solid #fed7d7",
                    }}
                >
                    <strong>Error:</strong> {error}
                </div>
            )}

            {/* Raw JSON Result Display */}
            {result && (
                <div>
                    <h3
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <span>Pipeline Output JSON</span>
                        {result.success && (
                            <span
                                style={{
                                    fontSize: "0.9rem",
                                    backgroundColor: "#e6fffa",
                                    color: "#234e52",
                                    padding: "0.2rem 0.6rem",
                                    borderRadius: "20px",
                                }}
                            >
                                Found: {result.count}
                            </span>
                        )}
                    </h3>
                    <pre
                        style={{
                            backgroundColor: "#f7fafc",
                            padding: "1rem",
                            borderRadius: "6px",
                            overflowX: "auto",
                            border: "1px solid #e2e8f0",
                            fontSize: "0.9rem",
                            lineHeight: "1.4",
                        }}
                    >
                        {JSON.stringify(result, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
