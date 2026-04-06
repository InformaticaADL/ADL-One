import React from 'react';

interface FileIconProps {
    mimetype?: string;
    filename?: string;
    size?: number;
}

const FileIcon: React.FC<FileIconProps> = ({ mimetype = '', filename = '', size = 24 }) => {
    const getFileType = () => {
        const m = (mimetype || '').toLowerCase();
        const f = (filename || '').toLowerCase();

        if (m.includes('pdf') || f.endsWith('.pdf')) return 'pdf';
        if (m.includes('sheet') || m.includes('excel') || m.includes('csv') || f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.csv')) return 'excel';
        if (m.includes('word') || m.includes('officedocument.wordprocessingml') || f.endsWith('.docx') || f.endsWith('.doc')) return 'word';
        if (m.includes('image') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.gif')) return 'image';
        if (m.includes('zip') || m.includes('rar') || m.includes('compressed') || f.endsWith('.zip') || f.endsWith('.rar')) return 'archive';
        return 'generic';
    };

    const type = getFileType();

    const icons: Record<string, React.ReactNode> = {
        pdf: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 18H17V20H7V18Z" fill="#E53935"/>
                <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3ZM19 19H5V5H19V19Z" fill="#E53935"/>
                <path d="M13.5 12V10H15.5V8.5H13.5V7H15.5V5.5H12V12H13.5ZM9 12V5.5H11.5V12H9ZM7 12V5.5H8.5V12H7Z" fill="#E53935" opacity="0.3"/>
                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#E53935"/>
                <path d="M14 2V8H20L14 2Z" fill="#B71C1C"/>
                <text x="6" y="18" fill="white" fontSize="6px" fontWeight="bold" fontFamily="Arial">PDF</text>
            </svg>
        ),
        excel: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#2E7D32"/>
                <path d="M14 2V8H20L14 2Z" fill="#1B5E20"/>
                <text x="6" y="18" fill="white" fontSize="6px" fontWeight="bold" fontFamily="Arial">XLS</text>
            </svg>
        ),
        word: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#1565C0"/>
                <path d="M14 2V8H20L14 2Z" fill="#0D47A1"/>
                <text x="6" y="18" fill="white" fontSize="6px" fontWeight="bold" fontFamily="Arial">DOC</text>
            </svg>
        ),
        image: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#FF8F00"/>
                <path d="M14 2V8H20L14 2Z" fill="#E65100"/>
                <circle cx="8.5" cy="11.5" r="1.5" fill="white"/>
                <path d="M18 19V14L15 17L12 14L6 20H18V19Z" fill="white" opacity="0.6"/>
            </svg>
        ),
        archive: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#455A64"/>
                <path d="M14 2V8H20L14 2Z" fill="#263238"/>
                <path d="M10 12H12V14H10V12ZM10 16H12V18H10V16ZM10 8H12V10H10V8Z" fill="white" opacity="0.8"/>
            </svg>
        ),
        generic: (
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#90A4AE"/>
                <path d="M14 2V8H20L14 2Z" fill="#455A64"/>
            </svg>
        )
    };

    return <div className="adl-file-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{icons[type]}</div>;
};

export default FileIcon;
