// TODO: Replace with your deployed Google Apps Script Web App URL
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzqJ3DGsA2NCLvGBX-U7VLjI4_4ze2XjqSiCbxOMMigtSivnXnRwCo6KeV6cWgqW7LeUQ/exec";

export const formatDateDDMMYYYY = (dateObj) => {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}-${month}-${year}`;
};

/**
 * Fetches attendance records from the Google Sheet.
 * @returns {Promise<Array>} Array of attendance objects.
 */
export const fetchAttendance = async () => {
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=read`);
        const data = await response.json();

        // Normalize dates to DD-MM-YYYY
        return data.map(record => {
            let normalizedDate = record.date;
            // Check if it's an ISO string (YYYY-MM-DD or similar) or other formats
            if (record.date && typeof record.date === 'string') {
                if (record.date.includes('T') || record.date.includes('-')) {
                    const d = new Date(record.date);
                    // Valid date and not just a DD-MM-YYYY string that Date() might misinterpret?
                    // If it's YYYY-MM-DD, Date() parses correctly.
                    // If it's Already DD-MM-YYYY, Date() might default to invalid or US format (MM-DD-YYYY).
                    // We only want to transform ISO-like strings coming from JSON.stringify of Date objects.
                    if (!isNaN(d.getTime()) && record.date.includes('T')) {
                        normalizedDate = formatDateDDMMYYYY(d);
                    }
                }
            }
            return { ...record, date: normalizedDate };
        });
    } catch (error) {
        console.error("Error fetching attendance:", error);
        return [];
    }
};

/**
 * Adds a new attendance record (or list of records).
 * @param {Object} record - The attendance data (or array of data).
 * @returns {Promise<boolean>} Success status.
 */
export const addAttendance = async (record) => {
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'add', ...record }),
        });
        return true;
    } catch (error) {
        console.error("Error adding attendance:", error);
        return false;
    }
};

/**
 * Deletes an attendance record.
 * @param {string|number} id - The ID of the record to delete.
 * @returns {Promise<boolean>} Success status.
 */
export const deleteAttendance = async (id) => {
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'delete', id: id }),
        });
        return true;
    } catch (error) {
        console.error("Error deleting attendance:", error);
        return false;
    }
};
