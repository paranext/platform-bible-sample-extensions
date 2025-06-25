// Form.tsx
import React from 'react';
import { useForm } from 'react-hook-form';

type FormData = {
  name: string;
  email: string;
};

export default function Form() {
  const { register, handleSubmit, reset } = useForm<FormData>();

  const onSubmit = (data: FormData) => {
    console.log('Form submitted:', data);
    alert(`Submitted: ${JSON.stringify(data)}`);
    reset();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      style={{
        background: 'white',
        padding: 20,
        border: '1px solid #ccc',
        borderRadius: 8,
        maxWidth: 300,
      }}
    >
      <div>
        <label>Name:</label>
        <input {...register('name')} />
      </div>
      <div style={{ marginTop: 10 }}>
        <label>Email:</label>
        <input {...register('email')} />
      </div>
      <button type="submit" style={{ marginTop: 10 }}>
        Submit
      </button>
    </form>
  );
}
