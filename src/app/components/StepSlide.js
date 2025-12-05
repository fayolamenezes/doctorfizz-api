"use client";

export default function StepSlide({ step, slide }) {
  return (
    <div className="bg-gray-50 rounded-xl shadow p-8 flex flex-col items-center justify-center">
      {/* Example placeholder → Replace with actual UI per slide */}
      <h2 className="text-2xl font-semibold mb-4">
        Step {step} - Slide {slide}
      </h2>
      <p className="text-gray-600">
        This is where the slide content for <strong>Step {step}</strong> will go.
      </p>
    </div>
  );
}
