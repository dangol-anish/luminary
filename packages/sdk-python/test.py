#!/usr/bin/env python3

from luminary import evaluate_call

# Test the evaluate_call function
# Note: Make sure the web app is running on localhost:3000

api_key = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjRhZWRiMDYyLWFkMmUtNGFkNy05N2Y3LWI2NWRkYjgzZGYyYSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3h5cnRycmp6bm55dWhldmR6b2hkLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI3Y2NmM2JiNC1lYTAzLTRlYWItODUwZC01YWJiMjU1MjgyNjciLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzc0MzY5ODk0LCJpYXQiOjE3NzQzNjYyOTQsImVtYWlsIjoiZGFuZ29sLmFuaXNoMDAxQGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJkYW5nb2wuYW5pc2gwMDFAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiN2NjZjNiYjQtZWEwMy00ZWFiLTg1MGQtNWFiYjI1NTI4MjY3In0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoib3RwIiwidGltZXN0YW1wIjoxNzc0MzY2Mjk0fV0sInNlc3Npb25faWQiOiJmMzVkNGY3MC1iYjIyLTRkYjMtYjA5Zi03MDExZmQxMGMwMGYiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.oPpmvPJQpXeVyK3vnI6kM6Dti-Pv5WchaLxAcbwpQOHfaEPaCWls-wo_LQzeCjgWh1SlsXsy3kjDSbLzO_FlLw"  # Replace with your actual API key

try:
    result = evaluate_call(
        prompt="What is the capital of France?",
        response="The capital of France is Paris.",
        model="gemini-2.5-flash",
        project="test-project",
        api_key=api_key
    )
    print("Success:", result)
except Exception as e:
    print("Error:", e)