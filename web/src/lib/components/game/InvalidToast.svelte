<script lang="ts">
  interface Props {
    message: string;
    testId: string;
  }

  let { message, testId }: Props = $props();
</script>

<p class="toast" role="status" data-testid={testId} style:pointer-events="none">
  {message}
</p>

<style>
  .toast {
    pointer-events: none;
    position: absolute;
    z-index: 30;
    right: 0.75rem;
    bottom: 0.75rem;
    left: 0.75rem;
    margin: 0;
    border: 1px solid rgb(185 28 28 / 0.25);
    border-radius: 0.5rem;
    background: rgb(254 242 242 / 0.96);
    padding: 0.5rem 0.75rem;
    color: #991b1b;
    box-shadow: 0 4px 14px rgb(68 38 22 / 0.14);
    text-align: center;
    font-size: 0.875rem;
    font-weight: 600;
  }
</style>
