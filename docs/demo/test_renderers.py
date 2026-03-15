from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def load_module(name: str, filename: str):
    path = ROOT / filename
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module from {path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


render_demo = load_module("render_demo", "render_demo.py")
render_placeholder_demo = load_module("render_placeholder_demo", "render_placeholder_demo.py")


class DemoRendererTests(unittest.TestCase):
    def test_terminal_response_progression_uses_constant_prefix_typing(self):
        self.assertGreater(render_demo.TERMINAL_FRAME_REPEAT, 0)

        for line in render_demo.TERMINAL_LINES:
            partials = render_demo.build_system_typing_progression(line)
            self.assertTrue(partials)
            self.assertEqual(partials[-1], line)

            previous = ""
            for partial in partials:
                self.assertTrue(line.startswith(partial))
                self.assertGreater(len(partial), len(previous))
                expected_growth = min(
                    render_demo.TERMINAL_CHAR_STEP,
                    len(line) - len(previous)
                )
                self.assertEqual(len(partial) - len(previous), expected_growth)
                previous = partial

        for working_line in render_demo.TERMINAL_WORKING_LINES:
            self.assertTrue(working_line.startswith("# Working"))
            self.assertNotIn("x", working_line.lower())

    def test_placeholder_demo_clears_between_questions_and_types_without_mistakes(self):
        self.assertGreater(render_placeholder_demo.PLACEHOLDER_TYPING_DELAY_MS, 0)
        plan = render_placeholder_demo.build_placeholder_sequence_plan()
        self.assertTrue(plan)

        for question in render_placeholder_demo.PROMPT_ZEN_PLACEHOLDER_QUESTIONS:
            partials = render_placeholder_demo.build_placeholder_typing_progression(question)
            self.assertTrue(partials)
            self.assertEqual(partials[-1], question)

            previous = ""
            for partial in partials:
                self.assertTrue(question.startswith(partial))
                self.assertEqual(len(partial) - len(previous), 1)
                previous = partial

        typing_steps = [step for step in plan if step.kind == "typing"]
        clear_steps = [step for step in plan if step.kind == "clear"]

        self.assertTrue(typing_steps)
        self.assertEqual(
            {step.frame_repeats for step in typing_steps},
            {render_placeholder_demo.frame_repeats_for_delay(render_placeholder_demo.PLACEHOLDER_TYPING_DELAY_MS)}
        )
        self.assertEqual(
            len(clear_steps),
            len(render_placeholder_demo.PROMPT_ZEN_PLACEHOLDER_QUESTIONS)
        )
        self.assertTrue(all(step.text == "" for step in clear_steps))

        frames = render_placeholder_demo.build_sequence()
        self.assertTrue(frames)

        blank_prompt = render_placeholder_demo.load_prompt_frame()
        font = render_placeholder_demo.ImageFont.truetype(
            str(render_placeholder_demo.ensure_prompt_font()),
            render_placeholder_demo.PROMPT_FONT_SIZE
        )
        layout = render_placeholder_demo.load_layout()
        cleared_frame = render_placeholder_demo.render_prompt_frame(blank_prompt, font, layout, "")

        self.assertEqual(frames[-1].tobytes(), cleared_frame.tobytes())


if __name__ == "__main__":
    unittest.main()
