/** Flat grass disc under everything. */
export function Ground(): JSX.Element {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.05} receiveShadow>
      <circleGeometry args={[750, 48]} />
      <meshStandardMaterial color="#7ec850" />
    </mesh>
  );
}
