-- Shared quotas apply to both billing periods and existing members.
UPDATE plans SET products=50 WHERE id='starter';
UPDATE plans SET products=200, shops=2 WHERE id='growth';
UPDATE plans SET products=1000, shops=5 WHERE id='brand';
