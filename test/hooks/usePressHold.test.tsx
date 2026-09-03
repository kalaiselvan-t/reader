import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { usePressHold } from '../../src/hooks/usePressHold';

function Harness({
  onStart,
  onStop,
  useSpace,
}: {
  onStart: () => void;
  onStop: () => void;
  useSpace?: boolean;
}) {
  const h = usePressHold(onStart, onStop, { useSpace });
  return <div data-testid="surface" {...h} style={{ width: 100, height: 100 }} />;
}

describe('usePressHold', () => {
  it('fires onStart on pointer down and onStop on pointer up', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    const { getByTestId } = render(<Harness onStart={onStart} onStop={onStop} />);
    const el = getByTestId('surface');
    fireEvent.pointerDown(el);
    expect(onStart).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(el);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('stops when the pointer leaves while held', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    const { getByTestId } = render(<Harness onStart={onStart} onStop={onStop} />);
    const el = getByTestId('surface');
    fireEvent.pointerDown(el);
    fireEvent.pointerLeave(el);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('starts once on Space keydown (ignoring auto-repeat) and stops on keyup', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    render(<Harness onStart={onStart} onStop={onStop} />);
    fireEvent.keyDown(window, { code: 'Space' });
    fireEvent.keyDown(window, { code: 'Space', repeat: true });
    expect(onStart).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(window, { code: 'Space' });
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('does not start on Space when focus is in a form control', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    const { container } = render(
      <div>
        <input data-testid="inp" />
        <Harness onStart={onStart} onStop={onStop} />
      </div>
    );
    const input = container.querySelector('input')!;
    input.focus();
    fireEvent.keyDown(input, { code: 'Space' });
    expect(onStart).not.toHaveBeenCalled();
  });

  it('stops on Space keyup even if focus shifted to a form control mid-hold', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    const { container } = render(
      <div>
        <input data-testid="inp" />
        <Harness onStart={onStart} onStop={onStop} />
      </div>
    );
    const input = container.querySelector('input')!;
    fireEvent.keyDown(window, { code: 'Space' });
    expect(onStart).toHaveBeenCalledTimes(1);
    input.focus();
    fireEvent.keyUp(input, { code: 'Space' });
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('ignores Space entirely when useSpace is false', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    render(<Harness onStart={onStart} onStop={onStop} useSpace={false} />);
    fireEvent.keyDown(window, { code: 'Space' });
    fireEvent.keyUp(window, { code: 'Space' });
    expect(onStart).not.toHaveBeenCalled();
    expect(onStop).not.toHaveBeenCalled();
  });
});
