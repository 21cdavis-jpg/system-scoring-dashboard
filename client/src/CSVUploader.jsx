import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

function CSVUploader(){
    const [uploadStatus,setUploadStatus] = useState('');

    const onDrop = useCallback((acceptedFiles) => {
        console.log("FILES:", acceptedFiles);
        console.log("BACKEND RESPONSE", data)
        const file = acceptedFiles[0]

        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploadStatus('Uploading...');
        console.log("SENDING REQUEST...");
        fetch('http://localhost:5000/upload-game', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            console.log("BACKEND RESPONSE:", data);
            setUploadStatus(`Uploaded! Game ID: ${data.game_id}`);
        });


    }, []);

    const {getRootProps, getInputProps, isDragActive} = useDropzone({
        onDrop,
    });

    return (
        <div>
            <div
                {...getRootProps()}
                style = {{
                    border: '2px dashed #999',
                    padding: '40px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: isDragActive ? '#eee':'#fafafa'
                }}
            >
                <input {...getInputProps()} />

                {isDragActive ? (
                    <p>Drop the CSV file here...</p>
                ) : (
                    <p>Drag & drop a CSV file here, or click to select</p>
                )}
            </div>

            <p style={{marginTop: '10px'}}>{uploadStatus}</p>
        </div>
    );
}

export default CSVUploader;