import React, { useState, useRef, useEffect } from 'react'
import './CustomSelect.scss'

const CustomSelect = ({ value, onChange, options, children, placeholder = 'Select...' }) => {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef(null)

    // Build options from children if provided, otherwise use options prop
    let items = options || []
    if (children) {
        items = React.Children.map(children, child => {
            if (child.type === 'option') {
                return { value: child.props.value, label: child.props.children }
            }
            return null
        }).filter(Boolean)
    }

    const selectedItem = items.find(item => item.value === value)

    const handleSelect = (selectedValue) => {
        onChange({ target: { value: selectedValue } }) // Mimic event object
        setIsOpen(false)
    }

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className={`custom-select ${isOpen ? 'open' : ''}`} ref={containerRef}>
            <div className="custom-select__trigger" onClick={() => setIsOpen(!isOpen)}>
                <span>{selectedItem ? selectedItem.label : placeholder}</span>
                <div className="arrow"></div>
            </div>
            {isOpen && (
                <div className="custom-select__options">
                    {items.map(item => (
                        <div
                            key={item.value}
                            className={`custom-select__option ${item.value === value ? 'selected' : ''}`}
                            onClick={() => handleSelect(item.value)}
                        >
                            {item.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default CustomSelect
