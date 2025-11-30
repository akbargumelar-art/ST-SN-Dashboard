// ... existing code ...
app.get('/api/adisti', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Changed default from 100 to 50
    const offset = (page - 1) * limit;
    
    const search = req.query.search || '';
// ... existing code ...