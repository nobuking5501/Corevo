#!/bin/bash
# Test script to add shift data to Firestore Emulator

PROJECT_ID="corevo-e1a8b"
FIRESTORE_URL="http://127.0.0.1:8080"
TENANT_ID="test-tenant-001"

echo "📅 Adding test shift data to Firestore Emulator"
echo "================================================"
echo ""

# シフトデータを追加する関数
add_shift() {
  local staff_id=$1
  local staff_name=$2
  local date=$3
  local start_time=$4
  local end_time=$5

  echo "Adding shift: $staff_name on $date ($start_time - $end_time)"

  curl -s -X PATCH \
    "${FIRESTORE_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/tenants/${TENANT_ID}/shifts/${staff_id}_${date}" \
    -H "Content-Type: application/json" \
    -d "{
      \"fields\": {
        \"staffId\": {\"stringValue\": \"${staff_id}\"},
        \"staffName\": {\"stringValue\": \"${staff_name}\"},
        \"date\": {\"stringValue\": \"${date}\"},
        \"startTime\": {\"stringValue\": \"${start_time}\"},
        \"endTime\": {\"stringValue\": \"${end_time}\"},
        \"createdAt\": {\"timestampValue\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"},
        \"updatedAt\": {\"timestampValue\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}
      }
    }" > /dev/null

  if [ $? -eq 0 ]; then
    echo "✅ Shift added successfully"
  else
    echo "❌ Failed to add shift"
  fi
  echo ""
}

# 今日の日付を取得（YYYY-MM-DD形式）
TODAY=$(date +"%Y-%m-%d")
TOMORROW=$(date -d "+1 day" +"%Y-%m-%d")
DAY_AFTER_TOMORROW=$(date -d "+2 days" +"%Y-%m-%d")

echo "📌 Adding shifts for the next 3 days..."
echo ""

# スタッフ1: 山田花子（今日〜3日分）
add_shift "staff_001" "山田花子" "$TODAY" "09:00" "17:00"
add_shift "staff_001" "山田花子" "$TOMORROW" "09:00" "17:00"
add_shift "staff_001" "山田花子" "$DAY_AFTER_TOMORROW" "10:00" "18:00"

# スタッフ2: 佐藤美咲（今日〜3日分）
add_shift "staff_002" "佐藤美咲" "$TODAY" "10:00" "18:00"
add_shift "staff_002" "佐藤美咲" "$TOMORROW" "13:00" "21:00"
add_shift "staff_002" "佐藤美咲" "$DAY_AFTER_TOMORROW" "09:00" "17:00"

echo "================================================"
echo "✅ Test shift data added successfully!"
echo ""
echo "You can now test the LINE booking UI at:"
echo "  http://localhost:3006/liff/booking"
echo ""
echo "Or test the availability API with:"
echo "  curl -X POST http://localhost:3006/api/calendar/availability \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"tenantId\": \"test-tenant-001\", \"date\": \"$TODAY\", \"serviceDuration\": 60}'"
echo ""
