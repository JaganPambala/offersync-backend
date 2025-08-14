# Comprehensive Candidate + Offer Creation API Guide

## Overview

This guide explains the new comprehensive API endpoints that handle both candidate creation and offer creation scenarios in a single, efficient workflow.

## Why Single API Instead of Two?

### Benefits of Single API:
- **Better UX**: Single form submission instead of two separate steps
- **Atomic Operations**: Either everything succeeds or fails together
- **Reduced Network Overhead**: One request instead of two
- **Better Error Handling**: Can rollback if any step fails
- **Consistent State**: Candidate and offer are always in sync

### Previous Approach (Two APIs):
```javascript
// Step 1: Create candidate
const candidate = await createCandidate(candidateData);
// Step 2: Create offer
const offer = await createOffer(offerData, candidate.id);
```

### New Approach (Single API):
```javascript
// Single call creates both candidate and offer
const result = await createCandidateWithOffer(candidateData, offerData);
```

## API Endpoints

### 1. Create New Candidate with Offer
**Endpoint**: `POST /api/candidates/with-offer`

**Use Case**: When HR fills the complete form with both candidate and offer details.

**Request Body**:
```javascript
{
  // Candidate fields
  "pan": "ABCDE1234F",
  "aadhaar": "123456789012", 
  "email": "candidate@example.com",
  "phone": "9876543210",
  "name": "John Doe",
  "location": {
    "city": "Mumbai",
    "state": "Maharashtra"
  },
  "profile": {
    "currentCompany": "Tech Corp",
    "currentRole": "Developer",
    "totalExperience": 36
  },
  
  // Offer fields
  "position": {
    "title": "Senior Developer",
    "department": "Engineering"
  },
  "compensation": {
    "base": 1200000,
    "total": 1500000,
    "currency": "INR"
  },
  "timeline": {
    "joiningDate": "2024-03-01"
  }
}
```

**Response**:
```javascript
{
  "success": true,
  "message": "Candidate and offer created successfully",
  "data": {
    "candidate": {
      "id": "candidate_id_here",
      "name": "John Doe",
      "status": "OFFERED",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "offer": {
      "id": "offer_id_here", 
      "position": { "title": "Senior Developer" },
      "status": "ACTIVE",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### 2. Create Offer for Existing Candidate
**Endpoint**: `POST /api/candidates/:candidateId/offer`

**Use Case**: When HR clicks "create offer" for an existing candidate.

**Request Body**:
```javascript
{
  "position": {
    "title": "Tech Lead",
    "department": "Engineering"
  },
  "compensation": {
    "base": 1800000,
    "total": 2200000,
    "currency": "INR"
  },
  "timeline": {
    "joiningDate": "2024-04-01"
  },
  "priority": "HIGH"
}
```

**Response**:
```javascript
{
  "success": true,
  "message": "Offer created successfully for existing candidate",
  "data": {
    "offer": {
      "id": "offer_id_here",
      "position": { "title": "Tech Lead" },
      "status": "ACTIVE",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "candidateId": "existing_candidate_id"
  }
}
```

### 3. Duplicate Check (Existing)
**Endpoint**: `POST /api/candidates/check`

**Use Case**: Check if candidate already exists before creating.

**Request Body**:
```javascript
{
  "pan": "ABCDE1234F",
  "aadhaar": "123456789012",
  "email": "candidate@example.com", 
  "phone": "9876543210"
}
```

## Frontend Implementation

### Scenario 1: Complete Form Submission
```javascript
// Frontend form with both candidate and offer fields
const handleSubmit = async (formData) => {
  try {
    const response = await axios.post('/api/candidates/with-offer', formData, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.data.success) {
      // Show success message
      // Redirect to offer details page
      // Update candidate list
    }
  } catch (error) {
    if (error.response?.status === 409) {
      // Handle duplicate candidate case
      showDuplicateWarning(error.response.data.data);
    } else {
      // Handle other errors
      showError(error.response?.data?.message || 'Something went wrong');
    }
  }
};
```

### Scenario 2: Create Offer for Existing Candidate
```javascript
// When HR clicks "Create Offer" button
const handleCreateOffer = async (candidateId, offerData) => {
  try {
    const response = await axios.post(`/api/candidates/${candidateId}/offer`, offerData, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.data.success) {
      // Show success message
      // Update offer list
      // Refresh candidate status
    }
  } catch (error) {
    showError(error.response?.data?.message || 'Failed to create offer');
  }
};
```

## Data Flow

### 1. New Candidate + Offer Creation
```
Frontend Form → Duplicate Check → Create Candidate → Create Offer → Update Status → Success Response
```

### 2. Existing Candidate Offer Creation
```
Select Candidate → Fill Offer Form → Create Offer → Update Candidate Status → Success Response
```

## Security Features

### Data Hashing
- PAN and Aadhaar are automatically hashed using SHA-256
- Original values are never stored in the database
- Hashing is done before any database operations

### Duplicate Prevention
- Multiple identifiers checked (PAN, Aadhaar, Email, Phone)
- Returns detailed information about existing candidates
- Prevents accidental duplicate creation

### Authorization
- All endpoints require valid JWT token
- HR can only create offers for candidates they have access to
- Audit trail maintained for all operations

## Error Handling

### Common Error Scenarios

#### 1. Duplicate Candidate (409)
```javascript
{
  "success": false,
  "message": "Candidate already exists with duplicate information",
  "data": {
    "duplicateCount": 1,
    "candidates": [...],
    "recommendations": [...]
  },
  "hasDuplicates": true
}
```

#### 2. Missing Required Fields (400)
```javascript
{
  "success": false,
  "message": "Missing required candidate fields: PAN, Aadhaar, Email, Phone, and Name are required"
}
```

#### 3. Candidate Not Found (404)
```javascript
{
  "success": false",
  "message": "Candidate not found"
}
```

## Best Practices

### 1. Frontend Validation
- Validate all required fields before submission
- Show appropriate error messages for missing data
- Implement real-time duplicate checking

### 2. Error Handling
- Always handle 409 (duplicate) responses gracefully
- Show duplicate information to help HR make decisions
- Implement retry mechanisms for network failures

### 3. User Experience
- Use loading states during API calls
- Provide clear feedback for all operations
- Implement optimistic updates where appropriate

## Testing

Use the provided test file `test-comprehensive-api.js` to test all scenarios:

```bash
# Install dependencies
npm install axios

# Run tests
node src/test-comprehensive-api.js
```

## Migration Guide

### From Old Two-API Approach
1. Replace separate candidate and offer creation calls
2. Use new `/with-offer` endpoint for new candidates
3. Use new `/:candidateId/offer` endpoint for existing candidates
4. Update error handling for new response formats

### Backward Compatibility
- Existing endpoints remain functional
- Old API calls will continue to work
- Gradual migration recommended

## Performance Considerations

### Database Operations
- Single transaction for candidate + offer creation
- Efficient indexing on hashed fields
- Minimal database round trips

### Network Optimization
- Single HTTP request instead of two
- Reduced latency and bandwidth usage
- Better mobile experience

## Monitoring and Analytics

### Metrics Tracked
- Candidate creation rate
- Offer creation rate
- Duplicate detection rate
- API response times
- Error rates by endpoint

### Logging
- All operations logged with HR ID
- Duplicate checks logged for analytics
- Performance metrics captured
- Error details logged for debugging
