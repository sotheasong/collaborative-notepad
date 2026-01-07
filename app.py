import os
import re
from pathlib import Path
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Storage configuration from environment variables
STORAGE_PATH = os.getenv('STORAGE_PATH', './storage')


def get_storage_path():
    """Get absolute path to storage directory, create if doesn't exist"""
    storage_path = Path(STORAGE_PATH).resolve()
    storage_path.mkdir(parents=True, exist_ok=True)
    return storage_path


def sanitize_path(filepath):
    """
    Sanitize filepath to prevent path traversal and other security issues.
    Allows subdirectories but prevents escaping storage root.
    """
    # Normalize the path
    filepath = filepath.replace('\\', '/')
    
    # Remove dangerous patterns
    filepath = re.sub(r'\.\.+', '', filepath)  # Remove .. sequences
    filepath = re.sub(r'^/+', '', filepath)     # Remove leading slashes
    filepath = re.sub(r'[<>:"|?*]', '', filepath)  # Remove dangerous characters
    
    # Split into parts and filter empty/dangerous parts
    parts = [p for p in filepath.split('/') if p and p != '..']
    
    # Rejoin with forward slashes
    sanitized = '/'.join(parts)
    
    # Limit total path length
    if len(sanitized) > 500:
        sanitized = sanitized[:500]
    
    return sanitized


def get_file_path(filename):
    """
    Convert filename to safe filesystem path.
    Returns absolute path within storage directory, or None if invalid.
    """
    sanitized = sanitize_path(filename)
    if not sanitized:
        return None
    
    storage_path = get_storage_path()
    file_path = (storage_path / sanitized).resolve()
    
    # Verify the path is within storage directory (prevent path traversal)
    try:
        file_path.relative_to(storage_path)
    except ValueError:
        return None
    
    return file_path


def ensure_directory_exists(file_path):
    """Create parent directories if they don't exist"""
    file_path.parent.mkdir(parents=True, exist_ok=True)


def list_all_files():
    """Scan storage directory recursively for all files"""
    storage_path = get_storage_path()
    files = []
    
    for path in storage_path.rglob('*'):
        if path.is_file():
            # Get relative path from storage root
            relative_path = path.relative_to(storage_path)
            files.append(str(relative_path))
    
    return sorted(files)


def file_exists(filename):
    """Check if file exists in storage"""
    file_path = get_file_path(filename)
    return file_path and file_path.exists()


def get_unique_filename(filename):
    """Generate unique filename if file already exists"""
    if not file_exists(filename):
        return filename
    
    # File exists, generate duplicate name
    sanitized = sanitize_path(filename)
    
    # Handle subdirectories
    if '/' in sanitized:
        dir_part = '/'.join(sanitized.split('/')[:-1])
        base_name = sanitized.split('/')[-1]
    else:
        dir_part = ''
        base_name = sanitized
    
    # Split name and extension
    if '.' in base_name:
        name_parts = base_name.rsplit('.', 1)
        name = name_parts[0]
        ext = '.' + name_parts[1]
    else:
        name = base_name
        ext = ''
    
    index = 1
    while True:
        if dir_part:
            new_filename = f"{dir_part}/{name}_{index}{ext}"
        else:
            new_filename = f"{name}_{index}{ext}"
        
        if not file_exists(new_filename):
            return new_filename
        index += 1


# Initialize storage on startup
storage_dir = get_storage_path()
print(f"Storage directory: {storage_dir}")
if not os.access(storage_dir, os.W_OK):
    print(f"WARNING: Storage directory {storage_dir} is not writable!")


@app.route('/')
def index():
    """Serve the main editor interface"""
    return render_template('index.html')


@app.route('/api/files', methods=['GET'])
def list_files():
    """List all files in storage"""
    try:
        files = list_all_files()
        return jsonify({'files': files})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/files/<path:filename>', methods=['GET'])
def get_file(filename):
    """Get file content by filename"""
    try:
        file_path = get_file_path(filename)
        
        if not file_path:
            return jsonify({'error': 'Invalid filename'}), 400
        
        if not file_path.exists():
            return jsonify({'error': 'File not found'}), 404
        
        try:
            content = file_path.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            # Try reading as binary and decode with replacement
            content = file_path.read_bytes().decode('utf-8', errors='replace')
        
        return jsonify({
            'file_name': filename,
            'content': content
        })
    except PermissionError:
        return jsonify({'error': 'Permission denied'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/files', methods=['POST'])
def create_file():
    """Create or save a new file"""
    try:
        data = request.get_json()
        if not data or 'file_name' not in data:
            return jsonify({'error': 'file_name is required'}), 400
        
        filename = sanitize_path(data['file_name'])
        if not filename:
            return jsonify({'error': 'Invalid filename'}), 400
        
        content = data.get('content', '')
        
        file_path = get_file_path(filename)
        if not file_path:
            return jsonify({'error': 'Invalid filename'}), 400
        
        # Check if file exists
        if file_path.exists():
            return jsonify({
                'error': 'File already exists',
                'file_name': filename,
                'exists': True
            }), 409
        
        # Create parent directories if needed
        ensure_directory_exists(file_path)
        
        # Write file
        file_path.write_text(content, encoding='utf-8')
        
        return jsonify({
            'message': 'File created successfully',
            'file_name': filename
        }), 201
    except PermissionError:
        return jsonify({'error': 'Permission denied'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/files/<path:filename>', methods=['PUT'])
def update_file(filename):
    """Update existing file content"""
    try:
        file_path = get_file_path(filename)
        
        if not file_path:
            return jsonify({'error': 'Invalid filename'}), 400
        
        data = request.get_json()
        if not data or 'content' not in data:
            return jsonify({'error': 'content is required'}), 400
        
        # Check if file exists
        if not file_path.exists():
            return jsonify({'error': 'File not found'}), 404
        
        # Update file
        file_path.write_text(data['content'], encoding='utf-8')
        
        return jsonify({
            'message': 'File updated successfully',
            'file_name': filename
        })
    except PermissionError:
        return jsonify({'error': 'Permission denied'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/files/<path:filename>', methods=['DELETE'])
def delete_file(filename):
    """Delete a file"""
    try:
        file_path = get_file_path(filename)
        
        if not file_path:
            return jsonify({'error': 'Invalid filename'}), 400
        
        if not file_path.exists():
            return jsonify({'error': 'File not found'}), 404
        
        # Delete the file
        file_path.unlink()
        
        # Try to remove empty parent directories
        storage_path = get_storage_path()
        parent = file_path.parent
        while parent != storage_path:
            try:
                parent.rmdir()  # Only removes if empty
                parent = parent.parent
            except OSError:
                break  # Directory not empty or other error
        
        return jsonify({'message': 'File deleted successfully'})
    except PermissionError:
        return jsonify({'error': 'Permission denied'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/files/duplicate', methods=['POST'])
def create_duplicate():
    """Create a duplicate of an existing file with a new name"""
    try:
        data = request.get_json()
        if not data or 'file_name' not in data:
            return jsonify({'error': 'file_name is required'}), 400
        
        original_name = sanitize_path(data['file_name'])
        if not original_name:
            return jsonify({'error': 'Invalid filename'}), 400
        
        original_path = get_file_path(original_name)
        if not original_path:
            return jsonify({'error': 'Invalid filename'}), 400
        
        if not original_path.exists():
            return jsonify({'error': 'Original file not found'}), 404
        
        # Get unique filename for duplicate
        new_filename = get_unique_filename(original_name)
        new_path = get_file_path(new_filename)
        
        if not new_path:
            return jsonify({'error': 'Could not generate duplicate filename'}), 500
        
        # Copy content to new file
        content = original_path.read_text(encoding='utf-8')
        ensure_directory_exists(new_path)
        new_path.write_text(content, encoding='utf-8')
        
        return jsonify({
            'message': 'Duplicate created successfully',
            'file_name': new_filename
        }), 201
    except PermissionError:
        return jsonify({'error': 'Permission denied'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('FLASK_PORT', 5000))
    app.run(host=host, port=port, debug=False)
