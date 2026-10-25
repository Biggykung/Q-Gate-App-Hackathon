USE health_gate;

-- Inserts one clearly labelled, synthetic patient for local demos.
INSERT INTO patients (Patient_name, Patient_age, Patient_weight, underlying_disease, health_fund)
SELECT 'DEMO ONLY - Sample Patient', 45, 68.5, 'Synthetic sample data', 'Demo only'
WHERE NOT EXISTS (
  SELECT 1 FROM patients WHERE Patient_name = 'DEMO ONLY - Sample Patient'
);

SET @demo_patient_id = (
  SELECT Patient_id FROM patients
  WHERE Patient_name = 'DEMO ONLY - Sample Patient'
  ORDER BY Patient_id LIMIT 1
);

INSERT INTO health_screening (patient_id, blood_sugar, blood_pressure, qcard_uacr_risk)
SELECT @demo_patient_id, 105, '120/80', '45'
WHERE @demo_patient_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM health_screening
    WHERE patient_id = @demo_patient_id
      AND blood_sugar = 105
      AND blood_pressure = '120/80'
      AND qcard_uacr_risk = '45'
  );
