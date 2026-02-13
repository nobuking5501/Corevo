#!/bin/bash
# Test script for Customer API

PROJECT_ID="corevo-e1a8b"
BASE_URL="http://127.0.0.1:5001/${PROJECT_ID}/asia-northeast1"

echo "🧪 Testing Customer API"
echo "======================="
echo ""

# Test 1: Create Customer
echo "1️⃣  Creating a test customer..."
RESPONSE=$(curl -s -X POST "${BASE_URL}/createCustomer" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "tenantId": "test-tenant-001",
      "name": "山田太郎",
      "kana": "やまだたろう",
      "email": "yamada@example.com",
      "phone": "090-1234-5678",
      "tags": ["VIP"],
      "notes": "テスト顧客",
      "consent": {
        "marketing": true,
        "photoUsage": false
      }
    }
  }')

echo "Response: $RESPONSE"
echo ""

# Extract customer ID (if successful)
CUSTOMER_ID=$(echo $RESPONSE | grep -o '"customerId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$CUSTOMER_ID" ]; then
  echo "✅ Customer created successfully! ID: $CUSTOMER_ID"
  echo ""

  # Test 2: Get Customer
  echo "2️⃣  Retrieving the customer..."
  curl -s -X POST "${BASE_URL}/getCustomer" \
    -H "Content-Type: application/json" \
    -d "{
      \"data\": {
        \"tenantId\": \"test-tenant-001\",
        \"customerId\": \"$CUSTOMER_ID\"
      }
    }" | jq .
  echo ""

  # Test 3: Search Customers
  echo "3️⃣  Searching for customers..."
  curl -s -X POST "${BASE_URL}/searchCustomers" \
    -H "Content-Type: application/json" \
    -d '{
      "data": {
        "tenantId": "test-tenant-001",
        "query": "山田",
        "searchBy": "name"
      }
    }' | jq .
  echo ""

else
  echo "❌ Failed to create customer"
fi

echo "======================="
echo "✅ Test completed"
