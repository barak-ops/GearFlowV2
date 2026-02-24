// ... (omitting imports and interfaces for brevity)

const statusTranslations: Record<OrderDetail['status'], string> = {
    pending: 'בקשה',
    approved: 'אושר',
    rejected: 'נדחה',
    checked_out: 'מושאל',
    returned: 'הוחזר',
    cancelled: 'בוטל'
};

const statusColors: Record<OrderDetail['status'], string> = {
// ... (rest of the file)