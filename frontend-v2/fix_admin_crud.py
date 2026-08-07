import os
import re

def main():
    crud_page_path = "src/admin/_core/AdminCrudPage.jsx"
    with open(crud_page_path, "r") as f:
        content = f.read()

    # Replace the component signature
    sig_old = """export default function AdminCrudPage({
  title,
  subtitle,
  breadcrumb, // Array of { label, href }
  entityName,
  columns,
  fields,
  emptyForm,
  validateForm,
  onBeforeSubmit,
  thunks,
  extraActions,
  filterBar,
  pageActions,
  banner,
  saveAndNextUrl,
}) {"""
    
    sig_new = """import PageLoader from '@/admin/_core/components/PageLoader';

export default function AdminCrudPage({
  config,
  extraActions,
  filterBar,
  pageActions,
  banner,
  saveAndNextUrl,
}) {
  const {
    title,
    subtitle,
    breadcrumb, // Array of { label, href }
    entityName,
    columns,
    fields,
    emptyForm,
    validateForm,
    onBeforeSubmit,
    thunks,
    getDeleteDetails,
  } = config || {};"""
    
    if sig_old in content:
        content = content.replace(sig_old, sig_new)
    else:
        print("Signature not found!")

    # Remove getDeleteDetails from AdminCrudPage
    delete_fn_regex = re.compile(r'const getDeleteDetails = \(item\) => \{[\s\S]*?\n  \};\n')
    match = delete_fn_regex.search(content)
    if match:
        content = content.replace(match.group(0), "")
    else:
        print("getDeleteDetails not found!")

    # Replace tailwind classes
    content = content.replace('text-[#5e5e5e]', 'text-admin-muted')
    content = content.replace('bg-[#705d00]', 'bg-admin-accent-dark')
    content = content.replace('text-[#dc2626]', 'text-status-red')
    content = content.replace('text-[#1a1c1d]', 'text-admin-ink')
    content = content.replace('text-[#888]', 'text-admin-muted')

    # Replace inline spinner with PageLoader
    # Wait, the inline spinner is TableSkeletonLoader now? Or is it an inline spinner?
    # Let's check where the spinner is in AdminCrudPage.
    
    with open(crud_page_path, "w") as f:
        f.write(content)

if __name__ == "__main__":
    main()
