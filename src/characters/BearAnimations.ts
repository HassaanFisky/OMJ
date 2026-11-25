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
  const upperLength = 34;
  const lowerLength = 34;
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

function normalizeDeg(deg: number): number {
  let d = ((deg % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

type JointName =
  | "torso"
  | "head"
  | "face"
  | "eyes"
  | "eyelids"
  | "closedEyes"
  | "leftBrow"
  | "rightBrow"
  | "leftEar"
  | "rightEar"
  | "leftEarInner"
  | "rightEarInner"
  | "mouth"
  | "tears"
  | "backHead"
  | "belly"
  | "tailPuff"
  | "warm"
  | "leftArm"
  | "rightArm"
  | "leftForearm"
  | "rightForearm"
  | "leftHand"
  | "rightHand"
  | "leftLeg"
  | "rightLeg"
  | "leftKnee"
  | "rightKnee"
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
    "torso", "head", "face",
    "eyes", "eyelids", "closedEyes",
    "leftBrow", "rightBrow", "leftEar", "rightEar", "leftEarInner", "rightEarInner", "mouth", "tears",
    "backHead", "belly", "tailPuff", "warm",
    "leftArm", "rightArm", "leftForearm", "rightForearm",
    "leftHand", "rightHand",
    "leftLeg", "rightLeg", "leftKnee", "rightKnee", "leftFoot", "rightFoot",
  ];

  const nodes = Object.fromEntries(
    jointNames.map((name) => [name, joint(name)]),
  ) as Record<JointName, SVGElement>;

  const eyeWaterL = root.querySelector<SVGElement>('[data-joint="eyeWater"]');
  const eyeWaterR = root.querySelector<SVGElement>('[data-joint="eyeWaterR"]');
  const bow = root.querySelector<SVGElement>('[data-joint="bow"]');
  const kissMarks = root.querySelector<SVGElement>('[data-joint="kissMarks"]');

  return (
    pose: Pose,
    time: number,
    reduced: boolean,
    warmth: number,
    cameraYaw = 0,
  ) => {
    root.setAttribute(
      "transform",
      `translate(${pose.x} ${pose.y}) rotate(${pose.rotation}) scale(${pose.scale})`,
    );
    root.setAttribute("opacity", String(pose.alpha));

    // Effective 360-degree yaw combining authored back-facing + interactive orbit yaw
    const totalYaw = normalizeDeg(pose.back * 180 + cameraYaw);
    const rad = (totalYaw * Math.PI) / 180;
    const cosYaw = Math.cos(rad);
    const sinYaw = Math.sin(rad);
    const isRear = cosYaw < -0.1;

    // Gentle chest breathing & secondary bow micro-motion
    const phase = time * 2.1 + (pose.x > 700 ? 0.8 : 0);
    const breath = reduced ? 0 : Math.sin(phase);
    nodes.torso.setAttribute(
      "transform",
      `translate(0 -52) scale(${(1 - breath * 0.008).toFixed(4)} ${(1 + breath * 0.016).toFixed(4)}) translate(0 52)`,
    );

    const bowSway = reduced ? 0 : Math.sin(time * 2.4 + 1.1) * (1.4 + pose.walk * 2.2);
    if (bow) {
      // Keep Yume's bow anchored on her upper-right head curve in front, or mirrored in rear view
      const bowX = sinYaw * -22;
      const flip = cosYaw >= 0 ? 1 : -1;
      bow.setAttribute(
        "transform",
        `translate(${bowX.toFixed(1)} 0) scale(${flip} 1) rotate(${bowSway.toFixed(2)} 37 -191)`,
      );
    }

    // Gentle breathing micro-nod when facing forward/side
    const headBreathing = reduced || isRear ? 0 : Math.sin(time * 2.1) * 1.1;
    const finalHead = pose.back > 0.5 ? 0 : pose.head + headBreathing;
    nodes.head.setAttribute("transform", `rotate(${finalHead} 0 -150)`);

    // Walking gait phase (0 when idle)
    const walkPhase = reduced ? 0 : time * 6.5;
    const stride = reduced ? 0 : Math.sin(walkPhase) * pose.walk;
    const liftL = reduced ? 0 : Math.max(0, Math.sin(walkPhase)) * pose.walk;
    const liftR = reduced ? 0 : Math.max(0, -Math.sin(walkPhase)) * pose.walk;

    // ── Articulated Arms + Chiral Paw Orientation ──────────────────────────
    for (const [side, sign] of [
      ["left", -1],
      ["right", 1],
    ] as const) {
      const shoulderX = sign * 42;
      const handX = side === "left" ? pose.leftX : pose.rightX;
      const handY = side === "left" ? pose.leftY : pose.rightY;

      const arm = solveArm(
        shoulderX,
        -90,
        handX,
        handY + stride * sign * 6,
        sign,
      );

      nodes[`${side}Arm`].setAttribute(
        "transform",
        `translate(${shoulderX} -90) rotate(${arm.upper})`,
      );

      nodes[`${side}Forearm`].setAttribute(
        "transform",
        `translate(0 34) rotate(${arm.lower})`,
      );

      // Gentle counter-rotation at wrist so inward-pointing thumb and palm stay natural
      nodes[`${side}Hand`].setAttribute(
        "transform",
        `translate(0 34) rotate(${-(arm.upper + arm.lower) * 0.22})`,
      );
    }

    // ── Articulated 2-Bone Legs (Hip -> Knee -> Shin -> Planted Foot) ──────
    const sit = clamp(pose.sit);
    const kneel = clamp(pose.kneel ?? 0);

    for (const [side, sign] of [
      ["left", -1],
      ["right", 1],
    ] as const) {
      const isLeft = side === "left";
      const swing = isLeft ? stride : -stride;
      const lift = isLeft ? liftL : liftR;

      let hipAngle = sign * 4;
      let kneeAngle = 0;
      let footAngle = -hipAngle;

      if (pose.walk > 0.01) {
        hipAngle = sign * 3 + swing * 22;
        kneeAngle = -sign * lift * 28;
        footAngle = -(hipAngle + kneeAngle) * 0.85;
      }

      if (sit > 0.01) {
        const sHip = sign * 52;
        const sKnee = -sign * 34;
        const sFoot = sign * -10;
        hipAngle = hipAngle * (1 - sit) + sHip * sit;
        kneeAngle = kneeAngle * (1 - sit) + sKnee * sit;
        footAngle = footAngle * (1 - sit) + sFoot * sit;
      }

      if (kneel > 0.01) {
        const kHip = isLeft ? 14 : -66;
        const kKnee = isLeft ? 82 : 72;
        const kFoot = isLeft ? -45 : -6;
        hipAngle = hipAngle * (1 - kneel) + kHip * kneel;
        kneeAngle = kneeAngle * (1 - kneel) + kKnee * kneel;
        footAngle = footAngle * (1 - kneel) + kFoot * kneel;
      }

      const hipY = kneel > 0.5 ? 12 : 4;
      nodes[`${side}Leg`].setAttribute(
        "transform",
        `translate(${sign * 24} ${hipY}) rotate(${hipAngle})`,
      );
      nodes[`${side}Knee`].setAttribute(
        "transform",
        `translate(0 24) rotate(${kneeAngle})`,
      );
      nodes[`${side}Foot`].setAttribute(
        "transform",
        `translate(0 26) rotate(${footAngle})`,
      );
    }

    // ── Non-Repetitive Organic Eye Blinking ──────────────────────────────────
    const cycle = (time + (pose.x > 600 ? 1.55 : 0.25)) % 6.1;
    let blink = 1;
    if (!reduced) {
      if (cycle > 4.95 && cycle < 5.15) {
        blink = Math.abs((cycle - 5.05) / 0.1);
      } else if (cycle > 5.32 && cycle < 5.48) {
        blink = Math.abs((cycle - 5.4) / 0.08);
      }
    }

    const lookX = clamp(pose.look, -6, 6);
    const lookY = pose.lookY ?? 0;
    nodes.eyes.setAttribute(
      "transform",
      `translate(${lookX} ${lookY - 154}) scale(1 ${clamp(blink, 0.06, 1)}) translate(0 ${154 - lookY})`,
    );

    const closed = clamp(pose.closed);
    nodes.eyes.setAttribute("opacity", String(clamp(1 - (closed - 0.15) * 2.6)));
    nodes.closedEyes.setAttribute("opacity", String(clamp((closed - 0.35) * 2.2)));
    nodes.eyelids.setAttribute("opacity", "0");

    // ── Expressive Eyebrows ──────────────────────────────────────────────────
    const browTilt = pose.sad * 6 + pose.nervous * 3 - (pose.smile ?? 0) * 2.5;
    const browLift = (pose.smile ?? 0) * 2.5 - pose.sad * 1.5;
    nodes.leftBrow.setAttribute(
      "d",
      `M-30 ${-172 + browTilt * 0.5 - browLift} Q-21 ${-177 - browTilt * 0.35 - browLift} -12 ${-172 - browTilt * 0.55 - browLift}`,
    );
    nodes.rightBrow.setAttribute(
      "d",
      `M12 ${-172 - browTilt * 0.55 - browLift} Q21 ${-177 - browTilt * 0.35 - browLift} 30 ${-172 + browTilt * 0.5 - browLift}`,
    );

    // ── 360-Degree Yaw Front/Side/Back Geometry Blending ─────────────────────
    const frontOpacity = clamp((cosYaw + 0.12) / 0.42, 0, 1);
    const backOpacity = clamp((-cosYaw - 0.05) / 0.45, 0, 1);
    const faceShiftX = -sinYaw * 24;
    const faceScaleX = clamp(0.46 + 0.54 * Math.abs(cosYaw), 0.46, 1);

    nodes.face.setAttribute("opacity", String(frontOpacity));
    nodes.face.setAttribute(
      "transform",
      `translate(${faceShiftX.toFixed(2)} 0) scale(${faceScaleX.toFixed(3)} 1)`,
    );
    nodes.belly.setAttribute("opacity", String(clamp(cosYaw + 0.25, 0, 1)));
    nodes.belly.setAttribute(
      "transform",
      `translate(${(-sinYaw * 16).toFixed(2)} 0) scale(${clamp(0.55 + 0.45 * Math.abs(cosYaw), 0.55, 1).toFixed(3)} 1)`,
    );
    nodes.backHead.setAttribute("opacity", String(backOpacity));

    // Rounded teddy bear ears: shift naturally with 360-degree yaw & hide inner cup in rear view
    const earShiftX = -sinYaw * 12;
    const earScaleL = clamp(0.72 + 0.28 * cosYaw - sinYaw * 0.14, 0.52, 1.05);
    const earScaleR = clamp(0.72 + 0.28 * cosYaw + sinYaw * 0.14, 0.52, 1.05);
    nodes.leftEar.setAttribute(
      "transform",
      `translate(${(-46 + earShiftX).toFixed(2)} -194) rotate(-22) scale(${earScaleL.toFixed(3)} 1)`,
    );
    nodes.rightEar.setAttribute(
      "transform",
      `translate(${(46 + earShiftX).toFixed(2)} -194) rotate(22) scale(${earScaleR.toFixed(3)} 1)`,
    );
    nodes.leftEarInner.setAttribute("opacity", String((frontOpacity * 0.92).toFixed(3)));
    nodes.rightEarInner.setAttribute("opacity", String((frontOpacity * 0.92).toFixed(3)));

    // Rounded tail puff visible in profile & rear views
    const tailOpacity = clamp(Math.max(backOpacity, (Math.abs(sinYaw) - 0.35) * 1.5), 0, 1);
    nodes.tailPuff.setAttribute("opacity", String(tailOpacity));
    nodes.tailPuff.setAttribute(
      "transform",
      `translate(${(sinYaw * 36).toFixed(1)} 0)`,
    );

    if (kissMarks) {
      kissMarks.setAttribute("opacity", String(clamp(pose.kissMark ?? 0)));
    }

    nodes.warm.setAttribute("opacity", String(clamp(warmth * 0.36)));

    // ── Expressive Mouth Flexure ─────────────────────────────────────────────
    const smileVal = pose.smile ?? (pose.closed > 0.4 ? 0.5 : 0.25);
    const mouthCurve = -115 + smileVal * 8 - pose.sad * 13;
    nodes.mouth.setAttribute("d", `M-10 -115 Q0 ${mouthCurve} 10 -115`);

    // ── Tear Drops & Watery Eye Sheen ────────────────────────────────────────
    const fall = reduced ? 0.25 : (time * 0.85) % 1;
    nodes.tears.setAttribute("transform", `translate(0 ${fall * 24})`);
    nodes.tears.setAttribute("opacity", String(pose.tear * (1 - fall)));

    if (eyeWaterL && eyeWaterR) {
      const waterSheen = (Math.sin(time * 4.5) * 0.18 + 0.82) * pose.tear;
      eyeWaterL.setAttribute("opacity", String(waterSheen * (1 - closed)));
      eyeWaterR.setAttribute("opacity", String(waterSheen * (1 - closed)));
    }
  };
}
