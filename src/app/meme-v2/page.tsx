import MemeSelectorV2 from '@/app/components/MemeSelectorV2';

export default function MemeCreationV2Page() {
  return (
    <div className="mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-center text-gray-100">Create Meme (V2 Flow)</h1>
      <div className="mx-auto">
        <MemeSelectorV2 />
      </div>
    </div>
  );
} 