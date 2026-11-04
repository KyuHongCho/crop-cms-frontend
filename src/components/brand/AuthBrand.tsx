import Logo from "./Logo";

export default function AuthBrand() {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
      <Logo className="text-xl text-primary" />
      <p className="text-sm text-balance text-muted-foreground">
        Crop-growing answers, each with its sources, mostly journal articles and FAO crop data you can open and check.
      </p>
    </div>
  );
}
