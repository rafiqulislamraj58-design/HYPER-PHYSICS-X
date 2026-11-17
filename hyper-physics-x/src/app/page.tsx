// src/app/page.tsx
import StudioLayout from '@/components/layout/StudioLayout';
import Viewport3D from '@/components/viewport/Viewport3D';

export default function HomePage() {
  return (
    <StudioLayout>
      <Viewport3D />
    </StudioLayout>
  );
}