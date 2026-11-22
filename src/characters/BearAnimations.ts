import {
  clamp,
  type Pose,
} from "../timeline/scenes";

function solveArm(
  shoulderX: number,
  shoulderY: number,
  handX: number,
  handY: number,
  bend: number,
) {
  const upperLength = 35;
  const lowerLength = 34;
  const dx = handX - shoulderX;
  const dy = handY - shoulderY;

  const distance = Math.min(
    upperLength + lowerLength - 0.01,
    Math.max(2, Math.hypot(dx, dy)),
  );

  const elbow =
    bend *
    Math.acos(
      clamp(
        (
          distance * distance -
          upperLength * upperLength -
          lowerLength * lowerLength
        ) / (2 * upperLength * lowerLength),
        -1,
        1,
      ),
    );

  const angle =
    Math.atan2(dy, dx) -
    Math.atan2(
      lowerLength * Math.sin(elbow),
      upperLength + lowerLength * Math.cos(elbow),
    );

  return {
    upper: angle * 180 / Math.PI - 90,
    lower: elbow * 180 / Math.PI,
  };
}

export function createBearPainter(root: SVGGElement) {
  const joint = (name: string) => {
    const node = root.querySelector<SVGElement>(
      `[data-joint="${name}"]`,
    );

    if (!node) {
      throw new Error(`Missing character joint: ${name}`);
    }

    return node;
  };

  const nodes = Object.fromEntries(
    [
      "head", "face", "eyes", "closedEyes", "mouth", "tears",
      "backSeam", "warm",
      "leftArm", "rightArm", "leftForearm", "rightForearm",
      "leftLeg", "rightLeg", "leftFoot", "rightFoot",
    ].map((name) => [name, joint(name)]),
  );

  return (
    pose: Pose,
    time: number,
    reduced: boolean,
    warmth: number,
  ) => {
    root.setAttribute(
      "transform",
      `translate(${pose.x} ${pose.y}) rotate(${pose.rotation}) scale(${pose.scale})`,
    );
    root.setAttribute("opacity", String(pose.alpha));

    nodes.head!.setAttribute(
      "transform",
      `rotate(${pose.head} 0 -150)`,
    );

    const gait = reduced ? 0 : Math.sin(time * 7.5) * pose.walk;

    for (const [side, sign] of [
      ["left", -1],
      ["right", 1],
    ] as const) {
      const shoulderX = sign * 42;
      const handX = side === "left" ? pose.leftX : pose.rightX;
      const handY = side === "left" ? pose.leftY : pose.rightY;

      const arm = solveArm(
        shoulderX,
        -92,
        handX,
        handY + gait * sign * 7,
        sign,
      );

      nodes[`${side}Arm`]!.setAttribute(
        "transform",
        `translate(${shoulderX} -92) rotate(${arm.upper})`,
      );

      nodes[`${side}Forearm`]!.setAttribute(
        "transform",
        `translate(0 35) rotate(${arm.lower})`,
      );

      const legAngle = sign * (pose.sit * 62 + gait * 12);

      nodes[`${side}Leg`]!.setAttribute(
        "transform",
        `translate(${sign * 26} 4) rotate(${legAngle})`,
      );

      nodes[`${side}Foot`]!.setAttribute(
        "transform",
        `rotate(${-legAngle * 0.4} 0 38)`,
      );
    }

    const phase = (time + (pose.x > 350 ? 1.1 : 0)) % 5.4;

    const blink = reduced
      ? 1
      : 1 -
        Math.max(0, 1 - Math.abs(phase - 4.8) / 0.1) * 0.96;

    nodes.eyes!.setAttribute(
      "transform",
      `translate(${pose.look} -157) scale(1 ${blink}) translate(0 157)`,
    );

    nodes.eyes!.setAttribute("opacity", String(1 - pose.closed));
    nodes.closedEyes!.setAttribute("opacity", String(pose.closed));
    nodes.face!.setAttribute("opacity", String(1 - pose.back));
    nodes.backSeam!.setAttribute("opacity", String(pose.back * 0.5));
    nodes.warm!.setAttribute("opacity", String(warmth * 0.25));

    nodes.mouth!.setAttribute(
      "d",
      `M-10-119Q0 ${-111 - pose.sad * 20} 10-119`,
    );

    const fall = reduced ? 0.25 : (time * 0.85) % 1;

    nodes.tears!.setAttribute(
      "transform",
      `translate(0 ${fall * 25})`,
    );
    nodes.tears!.setAttribute(
      "opacity",
      String(pose.tear * (1 - fall)),
    );
  };
}
