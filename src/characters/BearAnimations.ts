import {
  clamp,
  type Pose,
} from "../timeline/scenes";

/**
 * Two-bone 2D inverse kinematics arm solver.
 * Calculates shoulder and elbow rotations with anatomically constrained elbow bend
 * to ensure plush paws reach contact targets naturally without torso clipping.
 */
function solveArm(
  shoulderX: number,
  shoulderY: number,
  handX: number,
  handY: number,
  bend: number,
) {
  const upperLength = 36;
  const lowerLength = 35;
  const dx = handX - shoulderX;
  const dy = handY - shoulderY;

  const distance = Math.min(
    upperLength + lowerLength - 0.05,
    Math.max(4, Math.hypot(dx, dy)),
  );

  const cosElbow = clamp(
    (distance * distance - upperLength * upperLength - lowerLength * lowerLength) /
      (2 * upperLength * lowerLength),
    -1,
    1,
  );

  const elbow = bend * Math.acos(cosElbow);

  const angle =
    Math.atan2(dy, dx) -
    Math.atan2(
      lowerLength * Math.sin(elbow),
      upperLength + lowerLength * Math.cos(elbow),
    );

  return {
    upper: (angle * 180) / Math.PI - 90,
    lower: (elbow * 180) / Math.PI,
  };
}

type JointName =
  | "head"
  | "face"
  | "eyes"
  | "closedEyes"
  | "mouth"
  | "tears"
  | "backSeam"
  | "belly"
  | "backTorsoSeam"
  | "warm"
  | "leftArm"
  | "rightArm"
  | "leftForearm"
  | "rightForearm"
  | "leftLeg"
  | "rightLeg"
  | "leftFoot"
  | "rightFoot";

export function createBearPainter(root: SVGGElement) {
  const joint = (name: string): SVGElement => {
    const el = root.querySelector<SVGElement>(`[data-joint="${name}"]`);
    if (!el) {
      throw new Error(`Missing character joint: ${name}`);
    }
    return el;
  };

  const jointNames: JointName[] = [
    "head", "face", "eyes", "closedEyes", "mouth", "tears",
    "backSeam", "belly", "backTorsoSeam", "warm",
    "leftArm", "rightArm", "leftForearm", "rightForearm",
    "leftLeg", "rightLeg", "leftFoot", "rightFoot",
  ];

  const nodes = Object.fromEntries(
    jointNames.map((name) => [name, joint(name)]),
  ) as Record<JointName, SVGElement>;

  // Optional layered aesthetic joints
  const eyeWaterL = root.querySelector<SVGElement>('[data-joint="eyeWater"]');
  const eyeWaterR = root.querySelector<SVGElement>('[data-joint="eyeWaterR"]');

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

    // Dynamic head rotation and gentle breathing micro-nod
    const headBreathing = reduced ? 0 : Math.sin(time * 2.2) * 1.2;
    nodes.head.setAttribute(
      "transform",
      `rotate(${pose.head + headBreathing} 0 -150)`,
    );

    // Natural walk cycle & nervous arm shiver
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

      nodes[`${side}Arm`].setAttribute(
        "transform",
        `translate(${shoulderX} -92) rotate(${arm.upper})`,
      );

      nodes[`${side}Forearm`].setAttribute(
        "transform",
        `translate(0 35) rotate(${arm.lower})`,
      );

      // Seated vs walking leg articulation
      const legAngle = sign * (pose.sit * 62 + gait * 12);

      nodes[`${side}Leg`].setAttribute(
        "transform",
        `translate(${sign * 26} 4) rotate(${legAngle})`,
      );

      nodes[`${side}Foot`].setAttribute(
        "transform",
        `rotate(${-legAngle * 0.4} 0 38)`,
      );
    }

    // Organic non-repetitive eye blinking
    // Dual interval logic: primary soft blink every 4-5s, plus occasional double-blink
    const cycle = (time + (pose.x > 350 ? 1.4 : 0)) % 5.8;
    let blink = 1;
    if (!reduced) {
      if (cycle > 4.9 && cycle < 5.1) {
        blink = Math.abs((cycle - 5.0) / 0.1);
      } else if (cycle > 5.25 && cycle < 5.4) {
        blink = Math.abs((cycle - 5.325) / 0.075);
      }
    }

    nodes.eyes.setAttribute(
      "transform",
      `translate(${pose.look} -157) scale(1 ${clamp(blink, 0.05, 1)}) translate(0 157)`,
    );

    nodes.eyes.setAttribute("opacity", String(1 - pose.closed));
    nodes.closedEyes.setAttribute("opacity", String(pose.closed));

    // back = 1 → facing away from camera: hide face, show back seam, adjust head
    // back = 0 → facing camera normally
    nodes.face.setAttribute("opacity", String(1 - pose.back));
    nodes.backSeam.setAttribute("opacity", String(pose.back * 0.65));
    nodes.belly.setAttribute("opacity", String(1 - pose.back));
    nodes.backTorsoSeam.setAttribute("opacity", String(pose.back * 0.75));
    nodes.warm.setAttribute("opacity", String(warmth * 0.28));

    // Dynamic emotional mouth curvature
    // In sad state, droops downward; in smile state, curves upward
    const mouthArch = -111 - pose.sad * 18 + (pose.closed > 0.5 ? 4 : 0);
    nodes.mouth.setAttribute(
      "d",
      `M-10-115Q0 ${mouthArch} 10-115`,
    );

    // Tear drop physics and glistening eye sheen
    const fall = reduced ? 0.25 : (time * 0.85) % 1;

    nodes.tears.setAttribute(
      "transform",
      `translate(0 ${fall * 26})`,
    );
    nodes.tears.setAttribute(
      "opacity",
      String(pose.tear * (1 - fall)),
    );

    if (eyeWaterL && eyeWaterR) {
      const waterSheen = (Math.sin(time * 5) * 0.2 + 0.8) * pose.tear;
      eyeWaterL.setAttribute("opacity", String(waterSheen * (1 - pose.closed)));
      eyeWaterR.setAttribute("opacity", String(waterSheen * (1 - pose.closed)));
    }
  };
}
